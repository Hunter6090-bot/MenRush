import { query } from '../db';
import { SubmitVenueClaimInput, DisputeVenueClaimInput, FreezeVenueClaimInput } from '../types/validation';

export interface VenueClaimRow {
  id: string;
  spot_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'disputed' | 'frozen';
  venue_role: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  website_or_social_proof: string | null;
  attestation_agreed: boolean;
  attestation_text: string;
  attested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  dispute_reason: string | null;
  disputed_at: string | null;
  disputed_by: string | null;
  frozen_reason: string | null;
  frozen_at: string | null;
  domain_email: string | null;
  domain_email_verified: boolean;
  phone_otp: string | null;
  phone_otp_verified: boolean;
  companies_house_num: string | null;
  companies_house_verified: boolean;
  created_at: string;
  updated_at: string;
  spot_name?: string;
  spot_city?: string | null;
  applicant_name?: string;
  applicant_email?: string;
}

export const venueClaimService = {
  /**
   * Submit a claim for an EXISTING commercial Hot Spot pin only.
   * Rejects non-commercial pins or non-existent spots.
   */
  async submitClaim(userId: string, spotId: string, input: SubmitVenueClaimInput): Promise<VenueClaimRow> {
    // 1. Verify user is not frozen/banned
    const userRes = await query(`SELECT id, is_frozen FROM users WHERE id = $1`, [userId]);
    if (!userRes.rows[0]) throw new Error('User not found');
    if (userRes.rows[0].is_frozen) {
      throw new Error('Your account is currently restricted from claiming venues.');
    }

    // 2. Verify spot exists, is active, and is COMMERCIAL
    const spotRes = await query(
      `SELECT hs.id, hs.name, hs.city, hs.claim_status, hs.claimed_by_user_id, c.is_commercial
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.id = $1 AND hs.is_active = TRUE`,
      [spotId],
    );
    const spot = spotRes.rows[0];
    if (!spot) {
      throw new Error('Venue not found');
    }
    if (!spot.is_commercial) {
      throw new Error('Only existing commercial venue pins can be claimed');
    }
    if (spot.claim_status === 'approved') {
      throw new Error('This venue is already claimed. If you believe this is in error, submit a dispute.');
    }
    if (spot.claim_status === 'frozen') {
      throw new Error('This venue is currently frozen due to an active dispute or administrative review.');
    }

    // Check if user already has an active pending claim for this venue
    const existing = await query(
      `SELECT id, status FROM venue_claims WHERE spot_id = $1 AND user_id = $2 AND status = 'pending'`,
      [spotId, userId],
    );
    if (existing.rows[0]) {
      throw new Error('You already have a pending claim for this venue');
    }

    const res = await query(
      `INSERT INTO venue_claims (
         spot_id, user_id, status, venue_role, contact_name, contact_email,
         contact_phone, website_or_social_proof, attestation_agreed,
         attestation_text, attested_at, domain_email, phone_otp,
         companies_house_num, created_at, updated_at
       ) VALUES (
         $1, $2, 'pending', $3, $4, $5,
         $6, $7, $8,
         $9, NOW(), $10, $11,
         $12, NOW(), NOW()
       )
       RETURNING *`,
      [
        spotId,
        userId,
        input.venue_role,
        input.contact_name,
        input.contact_email,
        input.contact_phone || null,
        input.website_or_social_proof || null,
        input.attestation_agreed,
        input.attestation_text,
        input.domain_email || null,
        input.phone_otp || null,
        input.companies_house_num || null,
      ],
    );

    // Update spot status to pending if not already
    await query(
      `UPDATE hot_spots SET claim_status = 'pending' WHERE id = $1 AND claim_status = 'unclaimed'`,
      [spotId],
    );

    return res.rows[0] as VenueClaimRow;
  },

  /**
   * Get active claim or status for a spot
   */
  async getClaimForSpot(spotId: string, userId?: string): Promise<{
    claim_status: string;
    is_claimed: boolean;
    is_calendar_managed: boolean;
    my_claim?: VenueClaimRow | null;
  }> {
    const spotRes = await query(
      `SELECT claim_status, claimed_by_user_id, is_calendar_managed FROM hot_spots WHERE id = $1`,
      [spotId],
    );
    if (!spotRes.rows[0]) throw new Error('Venue not found');

    const spot = spotRes.rows[0];
    let myClaim: VenueClaimRow | null = null;
    if (userId) {
      const claimRes = await query(
        `SELECT * FROM venue_claims WHERE spot_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [spotId, userId],
      );
      myClaim = (claimRes.rows[0] as VenueClaimRow) || null;
    }

    return {
      claim_status: spot.claim_status,
      is_claimed: spot.claim_status === 'approved',
      is_calendar_managed: Boolean(spot.is_calendar_managed),
      my_claim: myClaim,
    };
  },

  /**
   * List claims submitted by a user
   */
  async listUserClaims(userId: string): Promise<VenueClaimRow[]> {
    const res = await query(
      `SELECT vc.*, hs.name AS spot_name, hs.city AS spot_city
         FROM venue_claims vc
         JOIN hot_spots hs ON hs.id = vc.spot_id
        WHERE vc.user_id = $1
        ORDER BY vc.created_at DESC`,
      [userId],
    );
    return res.rows as VenueClaimRow[];
  },

  /**
   * Submit dispute for a claimed venue
   */
  async disputeClaim(userId: string, spotId: string, input: DisputeVenueClaimInput): Promise<VenueClaimRow> {
    const spotRes = await query(
      `SELECT hs.id, hs.claim_status, hs.active_claim_id
         FROM hot_spots hs
        WHERE hs.id = $1 AND hs.is_active = TRUE`,
      [spotId],
    );
    const spot = spotRes.rows[0];
    if (!spot) throw new Error('Venue not found');
    if (spot.claim_status !== 'approved' && spot.claim_status !== 'pending') {
      throw new Error('This venue does not have an active claim to dispute');
    }

    // Freeze the venue calendar rights and update dispute fields
    await query(
      `UPDATE hot_spots
          SET claim_status = 'disputed', is_calendar_managed = FALSE
        WHERE id = $1`,
      [spotId],
    );

    let claimId = spot.active_claim_id;
    if (!claimId) {
      const latestClaim = await query(
        `SELECT id FROM venue_claims WHERE spot_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [spotId],
      );
      claimId = latestClaim.rows[0]?.id;
    }

    if (claimId) {
      const updated = await query(
        `UPDATE venue_claims
            SET status = 'disputed',
                dispute_reason = $1,
                disputed_at = NOW(),
                disputed_by = $2,
                updated_at = NOW()
          WHERE id = $3
          RETURNING *`,
        [input.dispute_reason, userId, claimId],
      );
      return updated.rows[0] as VenueClaimRow;
    }

    throw new Error('No claim record found to dispute');
  },

  // ── Ops / Human Review Functions (Gated by ADMIN_TOKEN) ──────────────────────

  /**
   * Ops: List pending claims
   */
  async listPendingClaims(): Promise<VenueClaimRow[]> {
    const res = await query(
      `SELECT vc.*, hs.name AS spot_name, hs.city AS spot_city, u.name AS applicant_name, u.email AS applicant_email
         FROM venue_claims vc
         JOIN hot_spots hs ON hs.id = vc.spot_id
         JOIN users u ON u.id = vc.user_id
        WHERE vc.status = 'pending'
        ORDER BY vc.created_at ASC`,
    );
    return res.rows as VenueClaimRow[];
  },

  /**
   * Ops: List all claims with filter
   */
  async listAllClaims(statusFilter?: string): Promise<VenueClaimRow[]> {
    const values: unknown[] = [];
    let whereSql = '';
    if (statusFilter) {
      values.push(statusFilter);
      whereSql = `WHERE vc.status = $1`;
    }
    const res = await query(
      `SELECT vc.*, hs.name AS spot_name, hs.city AS spot_city, u.name AS applicant_name, u.email AS applicant_email
         FROM venue_claims vc
         JOIN hot_spots hs ON hs.id = vc.spot_id
         JOIN users u ON u.id = vc.user_id
        ${whereSql}
        ORDER BY vc.created_at DESC
        LIMIT 100`,
      values,
    );
    return res.rows as VenueClaimRow[];
  },

  /**
   * Ops: Approve claim -> grants calendar management rights
   */
  async approveClaim(claimId: string, reviewer: string, notes?: string): Promise<VenueClaimRow> {
    const claimRes = await query(`SELECT * FROM venue_claims WHERE id = $1`, [claimId]);
    const claim = claimRes.rows[0] as VenueClaimRow | undefined;
    if (!claim) throw new Error('Claim not found');
    if (claim.status === 'approved') return claim;

    // Check if spot already claimed by someone else
    const spotRes = await query(`SELECT id, claim_status FROM hot_spots WHERE id = $1`, [claim.spot_id]);
    if (!spotRes.rows[0]) throw new Error('Venue not found');

    const client = await query(
      `UPDATE venue_claims
          SET status = 'approved',
              reviewed_at = NOW(),
              reviewed_by = $1,
              review_notes = $2,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [reviewer, notes || null, claimId],
    );

    // Update hot spot: set claimed_by_user_id, active_claim_id, claim_status = 'approved', is_calendar_managed = TRUE
    await query(
      `UPDATE hot_spots
          SET claimed_by_user_id = $1,
              active_claim_id = $2,
              claim_status = 'approved',
              claimed_at = NOW(),
              is_calendar_managed = TRUE
        WHERE id = $3`,
      [claim.user_id, claimId, claim.spot_id],
    );

    // Reject any other pending claims for this spot
    await query(
      `UPDATE venue_claims
          SET status = 'rejected',
              reviewed_at = NOW(),
              reviewed_by = $1,
              review_notes = 'Another claim was approved for this venue',
              updated_at = NOW()
        WHERE spot_id = $2 AND id != $3 AND status = 'pending'`,
      [reviewer, claim.spot_id, claimId],
    );

    return client.rows[0] as VenueClaimRow;
  },

  /**
   * Ops: Reject claim
   */
  async rejectClaim(claimId: string, reviewer: string, notes?: string): Promise<VenueClaimRow> {
    const claimRes = await query(`SELECT * FROM venue_claims WHERE id = $1`, [claimId]);
    const claim = claimRes.rows[0] as VenueClaimRow | undefined;
    if (!claim) throw new Error('Claim not found');

    const res = await query(
      `UPDATE venue_claims
          SET status = 'rejected',
              reviewed_at = NOW(),
              reviewed_by = $1,
              review_notes = $2,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [reviewer, notes || 'Claim rejected by ops review', claimId],
    );

    // Reset hot spot claim_status if no other approved claim
    const hasApproved = await query(
      `SELECT id FROM venue_claims WHERE spot_id = $1 AND status = 'approved'`,
      [claim.spot_id],
    );
    if (!hasApproved.rows[0]) {
      await query(
        `UPDATE hot_spots
            SET claim_status = 'unclaimed',
                claimed_by_user_id = NULL,
                active_claim_id = NULL,
                is_calendar_managed = FALSE
          WHERE id = $1 AND active_claim_id = $2`,
        [claim.spot_id, claimId],
      );
    }

    return res.rows[0] as VenueClaimRow;
  },

  /**
   * Ops: Freeze / False-claim ban path
   */
  async freezeClaim(claimId: string, reviewer: string, input: FreezeVenueClaimInput): Promise<VenueClaimRow> {
    const claimRes = await query(`SELECT * FROM venue_claims WHERE id = $1`, [claimId]);
    const claim = claimRes.rows[0] as VenueClaimRow | undefined;
    if (!claim) throw new Error('Claim not found');

    const res = await query(
      `UPDATE venue_claims
          SET status = 'frozen',
              frozen_reason = $1,
              frozen_at = NOW(),
              reviewed_at = NOW(),
              reviewed_by = $2,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [input.frozen_reason, reviewer, claimId],
    );

    // Freeze hot spot calendar
    await query(
      `UPDATE hot_spots
          SET claim_status = 'frozen',
              is_calendar_managed = FALSE
        WHERE id = $1`,
      [claim.spot_id],
    );

    // If false-claim ban user requested
    if (input.ban_user) {
      await query(
        `UPDATE users
            SET is_frozen = TRUE,
                frozen_reason = $1,
                frozen_at = NOW()
          WHERE id = $2`,
        [`False venue claim ban: ${input.frozen_reason}`, claim.user_id],
      );
    }

    return res.rows[0] as VenueClaimRow;
  },
};
