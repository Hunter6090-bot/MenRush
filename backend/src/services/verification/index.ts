import fs from 'fs/promises';
import path from 'path';
import { query } from '../../db';
import {
  DocumentAlreadyUsedError,
  SubmitVerificationResult,
  VerificationStateRow,
  VerificationStatus,
} from './types';

export { DocumentAlreadyUsedError, VerificationStateRow, VerificationStatus };

const verificationDir = path.resolve(__dirname, '../../../uploads/verification');

function autoApproveEnabled(): boolean {
  return process.env.VERIFICATION_AUTO_APPROVE !== 'false';
}

async function removeSubmissionFiles(idFrontKey: string, selfieKey: string): Promise<void> {
  await Promise.allSettled([
    fs.unlink(path.join(verificationDir, idFrontKey)),
    fs.unlink(path.join(verificationDir, selfieKey)),
  ]);
}

async function latestSubmission(userId: string) {
  const res = await query(
    `SELECT id, id_front_key, selfie_key, status
       FROM verification_submissions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

export const verificationService = {
  async getState(userId: string): Promise<VerificationStateRow> {
    const res = await query(
      `SELECT is_verified, verification_status, verification_session_id,
              verification_provider, verified_at, rejection_reason
         FROM users WHERE id = $1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('user_not_found');
    return row;
  },

  async submitVerification(
    userId: string,
    files: { idFrontPath: string; idFrontKey: string; selfiePath: string; selfieKey: string },
  ): Promise<SubmitVerificationResult> {
    const state = await this.getState(userId);
    if (state.is_verified) {
      const err = new Error('already_verified');
      (err as any).code = 'already_verified';
      throw err;
    }

    const previous = await latestSubmission(userId);
    if (previous) {
      await removeSubmissionFiles(previous.id_front_key, previous.selfie_key);
    }

    const { faceMatchService } = await import('./face-match.service');
    const faceResult = await faceMatchService.compare(files.idFrontPath, files.selfiePath);

    type SubmissionStatus = 'pending' | 'approved' | 'rejected';
    let submissionStatus: SubmissionStatus = 'pending';
    let userStatus: VerificationStatus = 'pending';
    let rejectionReason: string | null = null;
    let reviewedBy: string | null = null;
    let reviewedAt: Date | null = null;

    if (!faceResult.idFaceFound) {
      submissionStatus = 'rejected';
      userStatus = 'rejected';
      rejectionReason = 'document_unverified_other';
      reviewedBy = 'auto';
      reviewedAt = new Date();
    } else if (!faceResult.selfieFaceFound) {
      submissionStatus = 'rejected';
      userStatus = 'rejected';
      rejectionReason = 'selfie_unverified_other';
      reviewedBy = 'auto';
      reviewedAt = new Date();
    } else if (faceResult.match) {
      if (autoApproveEnabled()) {
        submissionStatus = 'approved';
        userStatus = 'verified';
        reviewedBy = 'auto';
        reviewedAt = new Date();
      }
    } else if (faceResult.review) {
      submissionStatus = 'pending';
      userStatus = 'pending';
    } else {
      submissionStatus = 'rejected';
      userStatus = 'rejected';
      rejectionReason = 'selfie_face_mismatch';
      reviewedBy = 'auto';
      reviewedAt = new Date();
    }

    const submissionRes = await query(
      `INSERT INTO verification_submissions (
         user_id, id_front_key, selfie_key,
         face_match_distance, face_match_passed,
         status, rejection_reason, reviewed_by, reviewed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId,
        files.idFrontKey,
        files.selfieKey,
        faceResult.distance,
        faceResult.match,
        submissionStatus,
        rejectionReason,
        reviewedBy,
        reviewedAt,
      ],
    );

    const submissionId = submissionRes.rows[0].id as string;

    if (userStatus === 'verified') {
      await this.markVerified(userId, submissionId);
      return {
        provider: 'menrush',
        status: 'verified',
        face_match_distance: faceResult.distance,
      };
    }

    if (userStatus === 'rejected') {
      await query(
        `UPDATE users
            SET verification_status = 'rejected',
                verification_provider = 'menrush',
                verification_session_id = $2,
                rejection_reason = $3,
                updated_at = NOW()
          WHERE id = $1`,
        [userId, submissionId, rejectionReason],
      );
      return {
        provider: 'menrush',
        status: 'rejected',
        rejection_reason: rejectionReason,
        face_match_distance: faceResult.distance,
      };
    }

    await query(
      `UPDATE users
          SET verification_status = 'pending',
              verification_provider = 'menrush',
              verification_session_id = $2,
              rejection_reason = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [userId, submissionId],
    );

    return {
      provider: 'menrush',
      status: userStatus,
      face_match_distance: faceResult.distance,
    };
  },

  async markVerified(userId: string, submissionId?: string | null): Promise<void> {
    await query(
      `UPDATE users
          SET is_verified = TRUE,
              verification_status = 'verified',
              verification_provider = 'menrush',
              verification_session_id = COALESCE($2, verification_session_id),
              verified_at = NOW(),
              rejection_reason = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [userId, submissionId ?? null],
    );

    if (submissionId) {
      await query(
        `UPDATE verification_submissions
            SET status = 'approved',
                reviewed_by = COALESCE(reviewed_by, 'admin'),
                reviewed_at = COALESCE(reviewed_at, NOW())
          WHERE id = $1`,
        [submissionId],
      );
    }
  },

  async markRejected(userId: string, reason: string, submissionId?: string | null): Promise<void> {
    await query(
      `UPDATE users
          SET verification_status = 'rejected',
              rejection_reason = $2,
              updated_at = NOW()
        WHERE id = $1`,
      [userId, reason],
    );

    if (submissionId) {
      await query(
        `UPDATE verification_submissions
            SET status = 'rejected',
                rejection_reason = $2,
                reviewed_by = 'admin',
                reviewed_at = NOW()
          WHERE id = $1`,
        [submissionId, reason],
      );
    }
  },

  async listPendingSubmissions() {
    const res = await query(
      `SELECT s.id, s.user_id, u.email, u.name, s.face_match_distance,
              s.face_match_passed, s.created_at
         FROM verification_submissions s
         JOIN users u ON u.id = s.user_id
        WHERE s.status = 'pending'
        ORDER BY s.created_at ASC`,
    );
    return res.rows;
  },

  async getSubmissionAssetPath(submissionId: string, kind: 'id_front' | 'selfie'): Promise<string | null> {
    const column = kind === 'id_front' ? 'id_front_key' : 'selfie_key';
    const res = await query(
      `SELECT ${column} AS storage_key
         FROM verification_submissions
        WHERE id = $1`,
      [submissionId],
    );
    const key = res.rows[0]?.storage_key as string | undefined;
    if (!key) return null;
    return path.join(verificationDir, key);
  },

  async approveSubmission(submissionId: string): Promise<void> {
    const res = await query(
      `SELECT user_id FROM verification_submissions WHERE id = $1 AND status = 'pending'`,
      [submissionId],
    );
    const row = res.rows[0];
    if (!row) {
      const err = new Error('submission_not_found');
      (err as any).code = 'submission_not_found';
      throw err;
    }
    await this.markVerified(row.user_id, submissionId);
  },

  async rejectSubmission(submissionId: string, reason: string): Promise<void> {
    const res = await query(
      `SELECT user_id FROM verification_submissions WHERE id = $1 AND status = 'pending'`,
      [submissionId],
    );
    const row = res.rows[0];
    if (!row) {
      const err = new Error('submission_not_found');
      (err as any).code = 'submission_not_found';
      throw err;
    }
    await this.markRejected(row.user_id, reason, submissionId);
  },
};