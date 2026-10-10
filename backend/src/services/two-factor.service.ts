import { authenticator } from 'otplib';
import { query } from '../db';
import {
  TOTP_DECRYPT_FAILED_MESSAGE,
  TotpCryptoError,
  decryptTotpSecretDetailed,
  encryptTotpSecret,
  type TotpDecryptResult,
} from '../security/totp-crypto';

authenticator.options = { window: 1 };

const ISSUER = 'MenRush';

type StoredSecret = TotpDecryptResult & { stored: string };

/** Decrypt a stored secret. Logs carry the user id and failure type only. */
function openStored(userId: string, stored: string): StoredSecret {
  try {
    return { ...decryptTotpSecretDetailed(stored), stored };
  } catch (err) {
    const failure = err instanceof TotpCryptoError ? err.failure : 'unknown';
    console.warn(`[2fa] decrypt failed user=${userId} failure=${failure}`);
    throw new Error(TOTP_DECRYPT_FAILED_MESSAGE);
  }
}

/**
 * Lazy re-encrypt after a successful verify, only during a key rotation. Guarded so a
 * concurrent setup or disable (different stored value) is never overwritten.
 */
async function reencryptIfNeeded(userId: string, opened: StoredSecret): Promise<void> {
  if (!opened.needsReencrypt) return;
  try {
    const next = encryptTotpSecret(opened.secret);
    await query(
      `UPDATE users SET totp_secret_encrypted = $1
        WHERE id = $2 AND totp_secret_encrypted = $3`,
      [next, userId, opened.stored],
    );
  } catch (err) {
    const failure = err instanceof TotpCryptoError ? err.failure : 'reencrypt';
    console.warn(`[2fa] re-encrypt skipped user=${userId} failure=${failure}`);
  }
}

export const twoFactorService = {
  async getStatus(userId: string): Promise<{ enabled: boolean; enabledAt: string | null }> {
    const result = await query(
      `SELECT totp_enabled, totp_enabled_at FROM users WHERE id = $1`,
      [userId],
    );
    if (result.rows.length === 0) throw new Error('User not found');
    const row = result.rows[0];
    return {
      enabled: !!row.totp_enabled,
      enabledAt: row.totp_enabled_at ? new Date(row.totp_enabled_at).toISOString() : null,
    };
  },

  async beginSetup(userId: string, email: string) {
    const existing = await query(
      `SELECT totp_enabled FROM users WHERE id = $1`,
      [userId],
    );
    if (existing.rows.length === 0) throw new Error('User not found');
    if (existing.rows[0].totp_enabled) {
      throw new Error('Two-factor authentication is already enabled');
    }

    const secret = authenticator.generateSecret();
    let encrypted: string;
    try {
      encrypted = encryptTotpSecret(secret);
    } catch (err) {
      const failure = err instanceof TotpCryptoError ? err.failure : 'unknown';
      console.warn(`[2fa] encrypt failed user=${userId} failure=${failure}`);
      throw err instanceof TotpCryptoError ? err : new Error(TOTP_DECRYPT_FAILED_MESSAGE);
    }

    await query(
      `UPDATE users
       SET totp_secret_encrypted = $1, totp_enabled = FALSE, totp_enabled_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [encrypted, userId],
    );

    const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
    return { secret, otpauthUrl };
  },

  async enable(userId: string, code: string) {
    const opened = await this.openPendingSecret(userId);
    if (!this.verifyCode(opened.secret, code)) {
      throw new Error('Invalid authentication code');
    }
    await reencryptIfNeeded(userId, opened);

    await query(
      `UPDATE users
       SET totp_enabled = TRUE, totp_enabled_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );

    return { ok: true };
  },

  async disable(userId: string, code: string) {
    const secret = await this.requireEnabledSecret(userId);
    if (!this.verifyCode(secret, code)) {
      throw new Error('Invalid authentication code');
    }

    await query(
      `UPDATE users
       SET totp_secret_encrypted = NULL, totp_enabled = FALSE, totp_enabled_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );

    const { trustedDeviceService } = await import('./trusted-device.service');
    await trustedDeviceService.revokeAll(userId);

    return { ok: true };
  },

  async isEnabled(userId: string): Promise<boolean> {
    const result = await query(`SELECT totp_enabled FROM users WHERE id = $1`, [userId]);
    return !!result.rows[0]?.totp_enabled;
  },

  async verifyForLogin(userId: string, code: string): Promise<boolean> {
    const opened = await this.openEnabledSecret(userId);
    const ok = this.verifyCode(opened.secret, code);
    if (ok) await reencryptIfNeeded(userId, opened);
    return ok;
  },

  verifyCode(secret: string, code: string): boolean {
    const normalized = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) return false;
    return authenticator.verify({ token: normalized, secret });
  },

  async requirePendingSecret(userId: string): Promise<string> {
    return (await this.openPendingSecret(userId)).secret;
  },

  async openPendingSecret(userId: string): Promise<StoredSecret> {
    const result = await query(
      `SELECT totp_secret_encrypted, totp_enabled FROM users WHERE id = $1`,
      [userId],
    );
    if (result.rows.length === 0) throw new Error('User not found');
    const row = result.rows[0];
    if (!row.totp_secret_encrypted) {
      throw new Error('Start two-factor setup before confirming a code');
    }
    if (row.totp_enabled) {
      throw new Error('Two-factor authentication is already enabled');
    }
    return openStored(userId, row.totp_secret_encrypted);
  },

  async requireEnabledSecret(userId: string): Promise<string> {
    return (await this.openEnabledSecret(userId)).secret;
  },

  async openEnabledSecret(userId: string): Promise<StoredSecret> {
    const result = await query(
      `SELECT totp_secret_encrypted, totp_enabled FROM users WHERE id = $1`,
      [userId],
    );
    if (result.rows.length === 0) throw new Error('User not found');
    const row = result.rows[0];
    if (!row.totp_enabled || !row.totp_secret_encrypted) {
      throw new Error('Two-factor authentication is not enabled');
    }
    return openStored(userId, row.totp_secret_encrypted);
  },
};