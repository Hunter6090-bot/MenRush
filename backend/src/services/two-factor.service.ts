import { authenticator } from 'otplib';
import { query } from '../db';
import { decryptTotpSecret, encryptTotpSecret } from '../security/totp-crypto';

authenticator.options = { window: 1 };

const ISSUER = 'MenRush';

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
    const encrypted = encryptTotpSecret(secret);

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
    const secret = await this.requirePendingSecret(userId);
    if (!this.verifyCode(secret, code)) {
      throw new Error('Invalid authentication code');
    }

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
    const secret = await this.requireEnabledSecret(userId);
    return this.verifyCode(secret, code);
  },

  verifyCode(secret: string, code: string): boolean {
    const normalized = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) return false;
    return authenticator.verify({ token: normalized, secret });
  },

  async requirePendingSecret(userId: string): Promise<string> {
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
    return decryptTotpSecret(row.totp_secret_encrypted);
  },

  async requireEnabledSecret(userId: string): Promise<string> {
    const result = await query(
      `SELECT totp_secret_encrypted, totp_enabled FROM users WHERE id = $1`,
      [userId],
    );
    if (result.rows.length === 0) throw new Error('User not found');
    const row = result.rows[0];
    if (!row.totp_enabled || !row.totp_secret_encrypted) {
      throw new Error('Two-factor authentication is not enabled');
    }
    return decryptTotpSecret(row.totp_secret_encrypted);
  },
};