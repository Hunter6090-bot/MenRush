import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db';
import pool from '../db';
import { RegisterInput, LoginInput, ResetPasswordInput } from '../types/validation';
import { sendEmail } from './mailer.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from './transactional-email.template';
import { v4 as uuidv4 } from 'uuid';
import { inviteCodeService, isInviteRequired } from './invite-code.service';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const HANDOFF_TOKEN_TTL_SECONDS = 30 * 60;
const TWO_FACTOR_PENDING_TTL_SECONDS = 5 * 60;

type TokenPayload = {
  userId: string;
  exp: number;
};

type HandoffTokenPayload = {
  sessionId: string;
  userId: string;
  scope: 'verify_handoff';
  exp: number;
};

type TwoFactorPendingPayload = {
  userId: string;
  scope: '2fa_pending';
  exp: number;
};

const base64UrlEncode = (input: Buffer | string): string => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (input: string): Buffer => {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
};

const signToken = (userId: string): string => {
  const payload: TokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadPart = base64UrlEncode(payloadJson);
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadJson)
    .digest();
  const signaturePart = base64UrlEncode(signature);
  return `${payloadPart}.${signaturePart}`;
};

const verifyTokenInternal = (token: string): TokenPayload => {
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) {
    throw new Error('Invalid token');
  }

  const payloadJson = base64UrlDecode(payloadPart).toString('utf8');
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadJson)
    .digest();
  const actualSignature = base64UrlDecode(signaturePart);

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('Invalid token');
  }

  const payload = JSON.parse(payloadJson) as TokenPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
};

export const authService = {
  async register(data: RegisterInput) {
    const id = uuidv4();
    const hashedPassword = await bcryptjs.hash(data.password, 10);
    const inviteCode = data.invite_code?.trim();

    if (isInviteRequired()) {
      if (!inviteCode) {
        throw new Error('A beta invite code is required to create an account.');
      }
      const check = await inviteCodeService.validate(inviteCode);
      if (!check.valid) {
        throw new Error('This invite code is invalid or has already been used.');
      }
    }

    // Signup always creates an unverified account. ID + matching selfie verification
    // is the only path to access the app. Set DEV_AUTO_VERIFY=true only for local dev.
    const autoVerify = process.env.DEV_AUTO_VERIFY === 'true';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, name, age, is_verified, verification_status`,
        [
          id,
          data.email,
          hashedPassword,
          data.name,
          data.age,
          autoVerify,
          autoVerify ? 'verified' : 'unverified',
        ],
      );

      const user = result.rows[0];

      if (isInviteRequired() && inviteCode) {
        await inviteCodeService.redeemForRegistration(inviteCode, user.id, client);
      }

      await client.query('COMMIT');

      const token = signToken(user.id);
      return { user, token };
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        throw new Error('Email already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async login(data: LoginInput) {
    const result = await query(
      `SELECT id, email, password_hash, name, photo_url, is_verified, verification_status,
              COALESCE(is_premium, FALSE) AS is_premium,
              COALESCE(premium_tier, 'free') AS premium_tier,
              COALESCE(totp_enabled, FALSE) AS totp_enabled
         FROM users WHERE LOWER(email) = $1`,
      [data.email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    const validPassword = await bcryptjs.compare(data.password, user.password_hash);

    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const publicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      photo_url: user.photo_url ?? undefined,
      is_verified: user.is_verified,
      verification_status: user.verification_status,
      is_premium: user.is_premium ?? false,
      premium_tier: user.premium_tier ?? 'free',
    };

    if (user.totp_enabled) {
      return {
        requires2fa: true as const,
        pendingToken: this.signTwoFactorPendingToken(user.id),
        user: publicUser,
      };
    }

    const token = signToken(user.id);

    return {
      requires2fa: false as const,
      user: publicUser,
      token,
    };
  },

  signTwoFactorPendingToken(userId: string): string {
    const payload: TwoFactorPendingPayload = {
      userId,
      scope: '2fa_pending',
      exp: Math.floor(Date.now() / 1000) + TWO_FACTOR_PENDING_TTL_SECONDS,
    };
    const payloadJson = JSON.stringify(payload);
    const payloadPart = base64UrlEncode(payloadJson);
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadJson)
      .digest();
    return `${payloadPart}.${base64UrlEncode(signature)}`;
  },

  verifyTwoFactorPendingToken(token: string): { userId: string } {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) {
      throw new Error('Invalid token');
    }

    const payloadJson = base64UrlDecode(payloadPart).toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadJson)
      .digest();
    const actualSignature = base64UrlDecode(signaturePart);

    if (
      expectedSignature.length !== actualSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, actualSignature)
    ) {
      throw new Error('Invalid token');
    }

    const payload = JSON.parse(payloadJson) as TwoFactorPendingPayload;
    if (payload.scope !== '2fa_pending') {
      throw new Error('Invalid token');
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return { userId: payload.userId };
  },

  async completeTwoFactorLogin(pendingToken: string, code: string) {
    const { userId } = this.verifyTwoFactorPendingToken(pendingToken);
    const { twoFactorService } = await import('./two-factor.service');
    const valid = await twoFactorService.verifyForLogin(userId, code);
    if (!valid) {
      throw new Error('Invalid authentication code');
    }

    const result = await query(
      `SELECT id, email, name, photo_url, is_verified, verification_status,
              COALESCE(is_premium, FALSE) AS is_premium,
              COALESCE(premium_tier, 'free') AS premium_tier
         FROM users WHERE id = $1`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        photo_url: user.photo_url ?? undefined,
        is_verified: user.is_verified,
        verification_status: user.verification_status,
        is_premium: user.is_premium ?? false,
        premium_tier: user.premium_tier ?? 'free',
      },
      token: signToken(user.id),
    };
  },

  verifyToken(token: string) {
    const payload = verifyTokenInternal(token);
    return { userId: payload.userId };
  },

  signHandoffToken(sessionId: string, userId: string): string {
    const payload: HandoffTokenPayload = {
      sessionId,
      userId,
      scope: 'verify_handoff',
      exp: Math.floor(Date.now() / 1000) + HANDOFF_TOKEN_TTL_SECONDS,
    };
    const payloadJson = JSON.stringify(payload);
    const payloadPart = base64UrlEncode(payloadJson);
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadJson)
      .digest();
    return `${payloadPart}.${base64UrlEncode(signature)}`;
  },

  verifyHandoffToken(token: string): { sessionId: string; userId: string } {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) {
      throw new Error('Invalid token');
    }

    const payloadJson = base64UrlDecode(payloadPart).toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadJson)
      .digest();
    const actualSignature = base64UrlDecode(signaturePart);

    if (
      expectedSignature.length !== actualSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, actualSignature)
    ) {
      throw new Error('Invalid token');
    }

    const payload = JSON.parse(payloadJson) as HandoffTokenPayload;
    if (payload.scope !== 'verify_handoff') {
      throw new Error('Invalid token');
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return { sessionId: payload.sessionId, userId: payload.userId };
  },

  async requestPasswordReset(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await query(
      `SELECT id, email FROM users WHERE LOWER(email) = $1`,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return { ok: true };
    }

    const userId = result.rows[0].id as string;
    const deliverTo = result.rows[0].email as string;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );

    const frontendUrl = (process.env.FRONTEND_URL || 'https://menrush.com').replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    const html = buildTransactionalEmail({
      title: 'Reset your MenRush password',
      preheader: 'Choose a new password — link valid for 1 hour.',
      eyebrow: 'Account Security',
      headlineHtml: 'Reset your<br/><span style="color:#C4832A;">password</span>',
      subheadline: 'We received a request to reset the password for your MenRush account.',
      bodyHtml: [
        transactionalParagraph(
          'Tap the button below to choose a new password. This link expires in <strong style="color:#F0E0C0;">1 hour</strong> and can only be used once.',
        ),
        transactionalParagraph(
          'If you didn&apos;t request this, you can safely ignore this email — your password won&apos;t change.',
        ),
      ].join(''),
      ctaUrl: resetUrl,
      ctaLabel: 'Choose a new password',
      footerNote: 'You received this because a password reset was requested for your MenRush account.',
    });

    await sendEmail({
      to: deliverTo,
      subject: 'Reset your MenRush password',
      text: `We received a request to reset your MenRush password.\n\nOpen this link to choose a new password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html,
    });

    return { ok: true };
  },

  async resetPassword(data: ResetPasswordInput) {
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');
    const result = await query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired reset link');
    }

    const { id: tokenId, user_id: userId } = result.rows[0];
    const hashedPassword = await bcryptjs.hash(data.password, 10);

    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, userId],
    );
    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);

    return { ok: true };
  },
};
