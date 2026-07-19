import crypto from 'crypto';
import { PoolClient } from 'pg';
import pool, { query } from '../db';

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function formatInviteCode(normalized: string): string {
  const body = normalized.startsWith('MENRUSH') ? normalized.slice(7) : normalized;
  if (body.length !== 8) return normalized;
  return `MENRUSH-${body.slice(0, 4)}-${body.slice(4)}`;
}

function randomPart(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return out;
}

export function generateInviteCodeValue(): { code: string; codeNormalized: string } {
  const codeNormalized = `MENRUSH${randomPart(4)}${randomPart(4)}`;
  return {
    code: formatInviteCode(codeNormalized),
    codeNormalized,
  };
}

export function isInviteRequired(): boolean {
  return process.env.BETA_INVITE_REQUIRED === 'true';
}

type InviteRow = {
  id: string;
  code: string;
  max_uses: number;
  use_count: number;
  expires_at: Date | null;
  revoked_at: Date | null;
};

function inviteUnavailableMessage(): string {
  return 'This invite code is invalid or has already been used.';
}

async function findInviteRow(
  client: PoolClient | typeof pool,
  normalized: string,
  forUpdate = false,
): Promise<InviteRow | null> {
  const lock = forUpdate ? 'FOR UPDATE' : '';
  const result = await client.query<InviteRow>(
    `SELECT id, code, max_uses, use_count, expires_at, revoked_at
     FROM beta_invite_codes
     WHERE code_normalized = $1
     ${lock}`,
    [normalized],
  );
  return result.rows[0] ?? null;
}

function isInviteUsable(row: InviteRow | null): row is InviteRow {
  if (!row || row.revoked_at) return false;
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) return false;
  return row.use_count < row.max_uses;
}

export const inviteCodeService = {
  async validate(rawCode: string): Promise<{ valid: true; code: string } | { valid: false }> {
    const normalized = normalizeInviteCode(rawCode);
    if (!normalized.startsWith('MENRUSH') || normalized.length !== 15) {
      return { valid: false };
    }

    const row = await findInviteRow(pool, normalized);
    if (!isInviteUsable(row)) {
      return { valid: false };
    }

    return { valid: true, code: row.code };
  },

  async redeemForRegistration(rawCode: string, userId: string, client: PoolClient): Promise<void> {
    const normalized = normalizeInviteCode(rawCode);
    if (!normalized.startsWith('MENRUSH') || normalized.length !== 15) {
      throw new Error(inviteUnavailableMessage());
    }

    const row = await findInviteRow(client, normalized, true);
    if (!isInviteUsable(row)) {
      throw new Error(inviteUnavailableMessage());
    }

    await client.query(
      `UPDATE beta_invite_codes
       SET use_count = use_count + 1
       WHERE id = $1`,
      [row.id],
    );

    await client.query(
      `INSERT INTO beta_invite_redemptions (invite_code_id, user_id)
       VALUES ($1, $2)`,
      [row.id, userId],
    );
  },

  async generateBatch(options: {
    count: number;
    maxUses?: number;
    expiresInDays?: number;
    note?: string;
  }): Promise<Array<{ code: string; code_normalized: string }>> {
    const count = Math.min(Math.max(options.count, 1), 500);
    const maxUses = Math.max(options.maxUses ?? 1, 1);
    const expiresAt =
      options.expiresInDays && options.expiresInDays > 0
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const created: Array<{ code: string; code_normalized: string }> = [];

    for (let i = 0; i < count; i += 1) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { code, codeNormalized } = generateInviteCodeValue();
        try {
          await query(
            `INSERT INTO beta_invite_codes (code, code_normalized, max_uses, expires_at, note)
             VALUES ($1, $2, $3, $4, $5)`,
            [code, codeNormalized, maxUses, expiresAt, options.note ?? null],
          );
          created.push({ code, code_normalized: codeNormalized });
          break;
        } catch (error: any) {
          if (error.code !== '23505' || attempt === 4) {
            throw error;
          }
        }
      }
    }

    return created;
  },

  async listCodes(limit = 100): Promise<
    Array<{
      id: string;
      code: string;
      max_uses: number;
      use_count: number;
      expires_at: Date | null;
      note: string | null;
      created_at: Date;
      revoked_at: Date | null;
    }>
  > {
    const capped = Math.min(Math.max(limit, 1), 500);
    const result = await query(
      `SELECT id, code, max_uses, use_count, expires_at, note, created_at, revoked_at
       FROM beta_invite_codes
       ORDER BY created_at DESC
       LIMIT $1`,
      [capped],
    );
    return result.rows;
  },
};
