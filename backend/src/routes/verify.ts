import { Router, Response } from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { handoffAuthMiddleware, HandoffRequest } from '../middleware/handoff';
import { authService } from '../services/auth.service';
import { verificationService, DocumentAlreadyUsedError } from '../services/verification.service';
import {
  verificationHandoffService,
  type HandoffRow,
} from '../services/verification/handoff.service';
import {
  idPrecheckService,
  type IdPrecheckTemplate,
} from '../services/verification/id-precheck.service';
import { safeUploadFilename, uploadFileFilter, validateFileSignature } from '../security/uploads';

const PRECHECK_TEMPLATES = new Set<IdPrecheckTemplate>([
  'passport',
  'driving_license_front',
  'driving_license_back',
]);

const router = Router();
const verificationDir = path.resolve(__dirname, '../../uploads/verification');
fs.mkdirSync(verificationDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, verificationDir),
    filename: (req, file, cb) => {
      try {
        const userId = (req as AuthRequest | HandoffRequest).userId!;
        cb(null, safeUploadFilename('verification', userId, file.mimetype));
      } catch (err) {
        cb(err as Error, '');
      }
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: uploadFileFilter('verification'),
});

function emitHandoffUpdate(req: AuthRequest, payload: Record<string, unknown>) {
  const io = req.app.get('io');
  if (io && req.userId) {
    io.to(`user:${req.userId}`).emit('verify:handoff', payload);
  }
}

function handoffPublicView(row: HandoffRow | null) {
  if (!row) return null;
  return {
    session_id: row.id,
    status: row.status,
    nationality: row.nationality,
    id_type: row.id_type,
    has_id_front: Boolean(row.id_front_key),
    has_id_back: Boolean(row.id_back_key),
    expires_at: row.expires_at.toISOString(),
    captured_at: row.captured_at?.toISOString() ?? null,
  };
}

router.post('/handoff/:sessionId/claim', async (req, res: Response) => {
  const sessionId = String(req.params.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'invalid_session' });

  try {
    const row = await verificationHandoffService.getById(sessionId);
    if (!row || row.status === 'expired' || row.status === 'consumed') {
      return res.status(404).json({ error: 'handoff_not_found' });
    }

    const handoff_token = authService.signHandoffToken(sessionId, row.user_id);
    res.json({
      handoff_token,
      session_id: sessionId,
      nationality: row.nationality,
      id_type: row.id_type,
      status: row.status,
      expires_at: row.expires_at.toISOString(),
    });
  } catch (err) {
    console.error('[verify] handoff claim error:', err);
    res.status(500).json({ error: 'handoff_claim_failed' });
  }
});

router.post(
  '/handoff/:sessionId/precheck',
  handoffAuthMiddleware,
  upload.single('id_image'),
  async (req: HandoffRequest, res: Response) => {
    const file = req.file;
    const template = String(req.body?.template || '').trim() as IdPrecheckTemplate;

    if (!file) {
      return res.status(400).json({ error: 'missing_file' });
    }

    if (!PRECHECK_TEMPLATES.has(template)) {
      await fsPromises.unlink(file.path).catch(() => undefined);
      return res.status(400).json({ error: 'invalid_template' });
    }

    try {
      const validSignature = await validateFileSignature(file.path, file.mimetype);
      if (!validSignature) {
        await fsPromises.unlink(file.path).catch(() => undefined);
        return res.status(400).json({ error: 'invalid_file_signature' });
      }

      const result = await idPrecheckService.check(file.path, template);
      res.json(result);
    } catch (err) {
      console.error('[verify] handoff precheck error:', err);
      res.status(500).json({ error: 'id_precheck_failed' });
    } finally {
      await fsPromises.unlink(file.path).catch(() => undefined);
    }
  },
);

router.post(
  '/handoff/:sessionId/upload',
  handoffAuthMiddleware,
  upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
  ]),
  async (req: HandoffRequest, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const idFront = files?.id_front?.[0];
    const idBack = files?.id_back?.[0];
    const sessionId = req.handoffSessionId!;

    if (!idFront) {
      return res.status(400).json({ error: 'missing_files' });
    }

    try {
      const session = await verificationHandoffService.getById(sessionId);
      if (!session || session.status !== 'waiting') {
        await fsPromises.unlink(idFront.path).catch(() => undefined);
        if (idBack) await fsPromises.unlink(idBack.path).catch(() => undefined);
        return res.status(409).json({ error: 'handoff_not_ready' });
      }

      if (session.id_type === 'driving_license' && !idBack) {
        await fsPromises.unlink(idFront.path).catch(() => undefined);
        return res.status(400).json({ error: 'missing_license_back' });
      }

      const validations = [
        validateFileSignature(idFront.path, idFront.mimetype),
        idBack ? validateFileSignature(idBack.path, idBack.mimetype) : Promise.resolve(true),
      ];
      const results = await Promise.all(validations);
      if (results.some((valid) => !valid)) {
        await Promise.allSettled([
          fsPromises.unlink(idFront.path),
          idBack ? fsPromises.unlink(idBack.path) : Promise.resolve(),
        ]);
        return res.status(400).json({ error: 'invalid_file_signature' });
      }

      const updated = await verificationHandoffService.markCaptured(sessionId, {
        id_front_key: idFront.filename,
        id_back_key: idBack?.filename ?? null,
      });

      emitHandoffUpdate({ ...req, userId: updated.user_id } as AuthRequest, {
        session_id: updated.id,
        status: updated.status,
        nationality: updated.nationality,
        id_type: updated.id_type,
        has_id_front: true,
        has_id_back: Boolean(updated.id_back_key),
        captured_at: updated.captured_at?.toISOString() ?? null,
      });

      res.json(handoffPublicView(updated));
    } catch (err) {
      await Promise.allSettled([
        idFront ? fsPromises.unlink(idFront.path) : Promise.resolve(),
        idBack ? fsPromises.unlink(idBack.path) : Promise.resolve(),
      ]);
      console.error('[verify] handoff upload error:', err);
      res.status(500).json({ error: 'handoff_upload_failed' });
    }
  },
);

router.use(authMiddleware);

router.post('/handoff', async (req: AuthRequest, res: Response) => {
  const nationality = String(req.body?.nationality || '').trim();
  const idType = String(req.body?.id_type || '').trim();

  if (!nationality) return res.status(400).json({ error: 'missing_nationality' });
  if (idType !== 'passport' && idType !== 'driving_license') {
    return res.status(400).json({ error: 'invalid_id_type' });
  }

  try {
    const session = await verificationHandoffService.createSession(req.userId!, {
      nationality,
      id_type: idType,
    });
    res.json(session);
  } catch (err) {
    console.error('[verify] handoff create error:', err);
    res.status(500).json({ error: 'handoff_create_failed' });
  }
});

router.get('/handoff/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const row = await verificationHandoffService.assertOwned(req.params.sessionId, req.userId!);
    res.json(handoffPublicView(row));
  } catch {
    res.status(404).json({ error: 'handoff_not_found' });
  }
});

router.post('/precheck', upload.single('id_image'), async (req: AuthRequest, res: Response) => {
  const file = req.file;
  const template = String(req.body?.template || '').trim() as IdPrecheckTemplate;

  if (!file) {
    return res.status(400).json({ error: 'missing_file' });
  }

  if (!PRECHECK_TEMPLATES.has(template)) {
    await fsPromises.unlink(file.path).catch(() => undefined);
    return res.status(400).json({ error: 'invalid_template' });
  }

  try {
    const validSignature = await validateFileSignature(file.path, file.mimetype);
    if (!validSignature) {
      await fsPromises.unlink(file.path).catch(() => undefined);
      return res.status(400).json({ error: 'invalid_file_signature' });
    }

    const result = await idPrecheckService.check(file.path, template);
    res.json(result);
  } catch (err) {
    console.error('[verify] precheck error:', err);
    res.status(500).json({ error: 'id_precheck_failed' });
  } finally {
    await fsPromises.unlink(file.path).catch(() => undefined);
  }
});

router.post(
  '/submit',
  upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const idFront = files?.id_front?.[0];
    const idBack = files?.id_back?.[0];
    const selfie = files?.selfie?.[0];
    const idType = String(req.body?.id_type || '').trim();
    const nationality = String(req.body?.nationality || '').trim() || null;
    const handoffSessionId = String(req.body?.handoff_session_id || '').trim() || null;

    if (!selfie) {
      return res.status(400).json({ error: 'missing_files' });
    }

    let resolvedIdFront = idFront;
    let resolvedIdBack = idBack;
    let resolvedNationality = nationality;
    let resolvedIdType = idType;

    if (handoffSessionId) {
      try {
        const handoffRow = await verificationHandoffService.consumeForSubmit(
          handoffSessionId,
          req.userId!,
        );
        resolvedNationality = handoffRow.nationality;
        resolvedIdType = handoffRow.id_type;
        resolvedIdFront = {
          path: path.join(verificationDir, handoffRow.id_front_key!),
          filename: handoffRow.id_front_key!,
          mimetype: 'image/jpeg',
        } as Express.Multer.File;
        if (handoffRow.id_back_key) {
          resolvedIdBack = {
            path: path.join(verificationDir, handoffRow.id_back_key),
            filename: handoffRow.id_back_key,
            mimetype: 'image/jpeg',
          } as Express.Multer.File;
        }
      } catch {
        await fsPromises.unlink(selfie.path).catch(() => undefined);
        return res.status(400).json({ error: 'handoff_not_ready' });
      }
    }

    if (!resolvedIdFront) {
      await fsPromises.unlink(selfie.path).catch(() => undefined);
      return res.status(400).json({ error: 'missing_files' });
    }

    if (resolvedIdType !== 'passport' && resolvedIdType !== 'driving_license') {
      await Promise.allSettled([
        handoffSessionId ? Promise.resolve() : fsPromises.unlink(resolvedIdFront.path),
        resolvedIdBack && !handoffSessionId ? fsPromises.unlink(resolvedIdBack.path) : Promise.resolve(),
        fsPromises.unlink(selfie.path),
      ]);
      return res.status(400).json({ error: 'invalid_id_type' });
    }

    if (resolvedIdType === 'driving_license' && (!resolvedIdBack || !resolvedNationality)) {
      await Promise.allSettled([
        handoffSessionId ? Promise.resolve() : fsPromises.unlink(resolvedIdFront.path),
        resolvedIdBack && !handoffSessionId ? fsPromises.unlink(resolvedIdBack.path) : Promise.resolve(),
        fsPromises.unlink(selfie.path),
      ]);
      return res.status(400).json({ error: 'missing_license_fields' });
    }

    if (!resolvedNationality) {
      await Promise.allSettled([
        handoffSessionId ? Promise.resolve() : fsPromises.unlink(resolvedIdFront.path),
        resolvedIdBack && !handoffSessionId ? fsPromises.unlink(resolvedIdBack.path) : Promise.resolve(),
        fsPromises.unlink(selfie.path),
      ]);
      return res.status(400).json({ error: 'missing_nationality' });
    }

    try {
      const validations = [
        validateFileSignature(resolvedIdFront.path, resolvedIdFront.mimetype),
        validateFileSignature(selfie.path, selfie.mimetype),
      ];
      if (resolvedIdBack) {
        validations.push(validateFileSignature(resolvedIdBack.path, resolvedIdBack.mimetype));
      }

      const results = await Promise.all(validations);
      if (results.some((valid) => !valid)) {
        await Promise.allSettled([
          handoffSessionId ? Promise.resolve() : fsPromises.unlink(resolvedIdFront.path),
          resolvedIdBack && !handoffSessionId ? fsPromises.unlink(resolvedIdBack.path) : Promise.resolve(),
          fsPromises.unlink(selfie.path),
        ]);
        return res.status(400).json({ error: 'invalid_file_signature' });
      }

      const result = await verificationService.submitVerification(req.userId!, {
        idFrontPath: resolvedIdFront.path,
        idFrontKey: resolvedIdFront.filename,
        idBackPath: resolvedIdBack?.path ?? null,
        idBackKey: resolvedIdBack?.filename ?? null,
        selfiePath: selfie.path,
        selfieKey: selfie.filename,
        idType: resolvedIdType,
        nationality: resolvedNationality,
      });

      res.json(result);
    } catch (err: any) {
      await Promise.allSettled([
        handoffSessionId ? Promise.resolve() : fsPromises.unlink(resolvedIdFront.path),
        resolvedIdBack && !handoffSessionId ? fsPromises.unlink(resolvedIdBack.path) : Promise.resolve(),
        fsPromises.unlink(selfie.path),
      ]);

      if (err?.code === 'already_verified') {
        return res.status(400).json({ error: 'already_verified' });
      }
      if (err instanceof DocumentAlreadyUsedError) {
        return res.status(409).json({ error: 'document_already_used' });
      }
      console.error('[verify] submit error:', err);
      return res.status(500).json({ error: 'verification_submit_failed' });
    }
  },
);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const state = await verificationService.getState(req.userId!);
    res.json({
      is_verified: state.is_verified,
      status: state.verification_status,
      provider: state.verification_provider,
      verified_at: state.verified_at,
      rejection_reason: state.rejection_reason,
    });
  } catch (err) {
    console.error('[verify] status error:', err);
    res.status(500).json({ error: 'verify_status_failed' });
  }
});

export default router;