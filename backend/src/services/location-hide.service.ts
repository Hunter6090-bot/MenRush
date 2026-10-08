import { query } from '../db';
import { premiumService } from './premium.service';

/** Generous cap so the list stays a safety tool, not a scraper. */
export const LOCATION_HIDE_MAX = 500;

export type LocationHiddenPerson = {
  id: string;
  name: string;
  photo_url: string | null;
  hidden_at: string;
};

export class LocationHideError extends Error {
  constructor(
    public readonly code:
      | 'premium_required'
      | 'invalid_target'
      | 'user_not_found'
      | 'limit_reached',
    public readonly status: number,
  ) {
    super(code);
    this.name = 'LocationHideError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Hide my location from" (Premium to add, anti-stalking).
 *
 * Only the owner can read their list. Nothing here is ever sent to the hidden
 * person: their responses just look like the owner is not nearby / has no
 * distance. Chat is not affected. Blocks still win (a block removes everything).
 */
export const locationHideService = {
  async list(ownerId: string): Promise<LocationHiddenPerson[]> {
    const res = await query(
      `SELECT u.id, u.name, u.photo_url, lh.created_at AS hidden_at
         FROM location_hidden_from lh
         JOIN users u ON u.id = lh.hidden_user_id
        WHERE lh.owner_id = $1
        ORDER BY lh.created_at DESC
        LIMIT ${LOCATION_HIDE_MAX}`,
      [ownerId],
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? 'Member'),
      photo_url: (row.photo_url as string | null) ?? null,
      hidden_at:
        row.hidden_at instanceof Date ? row.hidden_at.toISOString() : String(row.hidden_at),
    }));
  },

  async add(ownerId: string, hiddenUserId: string): Promise<{ hidden: true }> {
    if (!UUID_RE.test(hiddenUserId) || hiddenUserId === ownerId) {
      throw new LocationHideError('invalid_target', 400);
    }
    if (!(await premiumService.isPremium(ownerId))) {
      throw new LocationHideError('premium_required', 402);
    }
    const target = await query(`SELECT 1 FROM users WHERE id = $1`, [hiddenUserId]);
    if (!target.rows[0]) {
      throw new LocationHideError('user_not_found', 404);
    }
    const count = await query(
      `SELECT COUNT(*)::int AS n FROM location_hidden_from WHERE owner_id = $1`,
      [ownerId],
    );
    const already = await query(
      `SELECT 1 FROM location_hidden_from WHERE owner_id = $1 AND hidden_user_id = $2`,
      [ownerId, hiddenUserId],
    );
    if (!already.rows[0] && Number(count.rows[0]?.n ?? 0) >= LOCATION_HIDE_MAX) {
      throw new LocationHideError('limit_reached', 409);
    }
    await query(
      `INSERT INTO location_hidden_from (owner_id, hidden_user_id)
       VALUES ($1, $2)
       ON CONFLICT (owner_id, hidden_user_id) DO NOTHING`,
      [ownerId, hiddenUserId],
    );
    return { hidden: true };
  },

  /** Always allowed (Premium or not). Idempotent. */
  async remove(ownerId: string, hiddenUserId: string): Promise<{ hidden: false }> {
    if (!UUID_RE.test(hiddenUserId)) {
      throw new LocationHideError('invalid_target', 400);
    }
    await query(
      `DELETE FROM location_hidden_from WHERE owner_id = $1 AND hidden_user_id = $2`,
      [ownerId, hiddenUserId],
    );
    return { hidden: false };
  },

  /** Owners (among `ownerIds`) who hide their location from `viewerId`. */
  async ownersHidingFrom(viewerId: string, ownerIds: string[]): Promise<Set<string>> {
    const ids = Array.from(new Set(ownerIds.filter((id) => UUID_RE.test(id))));
    if (ids.length === 0) return new Set();
    const res = await query(
      `SELECT owner_id FROM location_hidden_from
        WHERE hidden_user_id = $1 AND owner_id = ANY($2::uuid[])`,
      [viewerId, ids],
    );
    return new Set(res.rows.map((r) => String(r.owner_id)));
  },

  /** Viewers (among `viewerIds`) that `ownerId` hides their location from. */
  async viewersHiddenBy(ownerId: string, viewerIds: string[]): Promise<Set<string>> {
    const ids = Array.from(new Set(viewerIds.filter((id) => UUID_RE.test(id))));
    if (ids.length === 0) return new Set();
    const res = await query(
      `SELECT hidden_user_id FROM location_hidden_from
        WHERE owner_id = $1 AND hidden_user_id = ANY($2::uuid[])`,
      [ownerId, ids],
    );
    return new Set(res.rows.map((r) => String(r.hidden_user_id)));
  },
};
