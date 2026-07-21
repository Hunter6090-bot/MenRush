import crypto from 'crypto';
import { query } from '../db';

const TRUST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRUSTED_DEVICES_PER_USER = 10;

export type TrustedDevicePublic = {
  id: string;
  label: string | null;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent?: boolean;
};

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function deviceLabelFromUserAgent(userAgent: string | undefined): string {
  const ua = (userAgent || '').trim();
  if (!ua) return 'Trusted browser';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let os = '';
  if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}

export const trustedDeviceService = {
  hashToken,

  async isTrusted(userId: string, rawToken: string | undefined | null): Promise<boolean> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
      return false;
    }

    const tokenHash = hashToken(rawToken);
    const result = await query(
      `UPDATE trusted_devices
          SET last_used_at = NOW()
        WHERE user_id = $1
          AND token_hash = $2
          AND revoked_at IS NULL
          AND expires_at > NOW()
        RETURNING id`,
      [userId, tokenHash],
    );
    return result.rows.length > 0;
  },

  async create(
    userId: string,
    userAgent: string | undefined,
  ): Promise<{ rawToken: string; expiresAt: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TRUST_TTL_MS);
    const label = deviceLabelFromUserAgent(userAgent);
    const ua = (userAgent || '').slice(0, 512) || null;

    // Cap active devices: revoke oldest when over limit.
    const active = await query(
      `SELECT id FROM trusted_devices
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY last_used_at ASC`,
      [userId],
    );
    if (active.rows.length >= MAX_TRUSTED_DEVICES_PER_USER) {
      const overflow = active.rows.length - MAX_TRUSTED_DEVICES_PER_USER + 1;
      const ids = active.rows.slice(0, overflow).map((r: { id: string }) => r.id);
      await query(
        `UPDATE trusted_devices SET revoked_at = NOW()
          WHERE id = ANY($1::uuid[]) AND user_id = $2`,
        [ids, userId],
      );
    }

    await query(
      `INSERT INTO trusted_devices (user_id, token_hash, label, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tokenHash, label, ua, expiresAt],
    );

    return { rawToken, expiresAt: expiresAt.toISOString() };
  },

  async list(userId: string, currentRawToken?: string | null): Promise<TrustedDevicePublic[]> {
    const currentHash = currentRawToken ? hashToken(currentRawToken) : null;
    const result = await query(
      `SELECT id, label, token_hash, last_used_at, expires_at, created_at
         FROM trusted_devices
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        ORDER BY last_used_at DESC`,
      [userId],
    );

    return result.rows.map((row: {
      id: string;
      label: string | null;
      token_hash: string;
      last_used_at: Date | string;
      expires_at: Date | string;
      created_at: Date | string;
    }) => ({
      id: row.id,
      label: row.label,
      lastUsedAt: new Date(row.last_used_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
      isCurrent: currentHash ? row.token_hash === currentHash : false,
    }));
  },

  async revoke(userId: string, deviceId: string): Promise<boolean> {
    const result = await query(
      `UPDATE trusted_devices
          SET revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING id`,
      [deviceId, userId],
    );
    return result.rows.length > 0;
  },

  async revokeAll(userId: string): Promise<void> {
    await query(
      `UPDATE trusted_devices SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  },
};
