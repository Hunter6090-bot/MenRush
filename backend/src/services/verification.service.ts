import Stripe from 'stripe';
import { query } from '../db';

// Stripe v22 ships its types via `export = StripeConstructor` with a nested
// namespace, so the default-import gives us the constructor but not the
// `Stripe.Event` / `Stripe.Identity.*` type subtree directly. We sidestep by
// using `InstanceType<typeof Stripe>` for the instance and treating event
// payloads as `any` — they're handled defensively below.
type StripeInstance = InstanceType<typeof Stripe>;

let _stripe: StripeInstance | null = null;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('stripe_not_configured');
    this.name = 'StripeNotConfiguredError';
  }
}

function getStripe(): StripeInstance {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test___SET_ME__') || key.length < 10) {
    throw new StripeNotConfiguredError();
  }
  _stripe = new Stripe(key, { apiVersion: '2024-06-20' as any });
  return _stripe;
}

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface VerificationStateRow {
  is_verified: boolean;
  verification_status: VerificationStatus;
  verification_session_id: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
}

export const verificationService = {
  async getState(userId: string): Promise<VerificationStateRow> {
    const res = await query(
      `SELECT is_verified, verification_status, verification_session_id,
              verified_at, rejection_reason
         FROM users WHERE id = $1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('user_not_found');
    return row;
  },

  // Creates a Stripe Identity VerificationSession (or reuses a pending one)
  // and returns the client_secret the frontend hands to Stripe.js.
  async startSession(userId: string): Promise<{ client_secret: string; status: VerificationStatus }> {
    const state = await this.getState(userId);
    if (state.is_verified) {
      const err = new Error('already_verified');
      (err as any).code = 'already_verified';
      throw err;
    }

    const stripe = getStripe();

    // Reuse an existing pending session if Stripe still considers it open —
    // creating a new one for every retry costs nothing for un-submitted
    // sessions but pollutes the user's history.
    if (state.verification_session_id && state.verification_status === 'pending') {
      try {
        const existing: any = await stripe.identity.verificationSessions.retrieve(
          state.verification_session_id,
        );
        if (existing.status === 'requires_input' || existing.status === 'processing') {
          if (existing.client_secret) {
            return { client_secret: existing.client_secret, status: 'pending' };
          }
        }
      } catch {
        // Session lookup failed — fall through and create a fresh one.
      }
    }

    const session: any = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { user_id: userId },
      options: {
        document: {
          require_matching_selfie: true,
          require_live_capture: true,
          allowed_types: ['driving_license', 'passport', 'id_card'],
        },
      },
    });

    if (!session.client_secret) {
      throw new Error('stripe_session_missing_client_secret');
    }

    await query(
      `UPDATE users
          SET verification_session_id = $1,
              verification_status     = 'pending',
              rejection_reason        = NULL,
              updated_at              = NOW()
        WHERE id = $2`,
      [session.id, userId],
    );

    return { client_secret: session.client_secret, status: 'pending' };
  },

  // Stripe webhook handler. Caller must pass the RAW request body (Buffer or
  // string) and the `stripe-signature` header — we verify here.
  async handleWebhook(rawBody: Buffer | string, signature: string | undefined): Promise<{ received: true }> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || secret.startsWith('whsec___SET_ME__')) {
      throw new StripeNotConfiguredError();
    }
    if (!signature) {
      const err = new Error('missing_signature');
      (err as any).code = 'invalid_signature';
      throw err;
    }
    const stripe = getStripe();

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      const err = new Error('invalid_signature');
      (err as any).code = 'invalid_signature';
      throw err;
    }

    const session = event?.data?.object ?? {};
    const userId: string | null = (session.metadata && session.metadata.user_id) || null;

    if (!userId) {
      // Event isn't associated with one of our users — ack and ignore.
      return { received: true };
    }

    switch (event.type) {
      case 'identity.verification_session.verified': {
        await query(
          `UPDATE users
              SET is_verified         = TRUE,
                  verification_status = 'verified',
                  verified_at         = NOW(),
                  rejection_reason    = NULL,
                  updated_at          = NOW()
            WHERE id = $1`,
          [userId],
        );
        break;
      }
      case 'identity.verification_session.requires_input': {
        const reason =
          (session.last_error && (session.last_error.reason || session.last_error.code)) ||
          'verification_failed';
        await query(
          `UPDATE users
              SET verification_status = 'rejected',
                  rejection_reason    = $1,
                  updated_at          = NOW()
            WHERE id = $2`,
          [String(reason).slice(0, 500), userId],
        );
        break;
      }
      case 'identity.verification_session.canceled': {
        await query(
          `UPDATE users
              SET verification_status     = 'unverified',
                  verification_session_id = NULL,
                  rejection_reason        = NULL,
                  updated_at              = NOW()
            WHERE id = $1`,
          [userId],
        );
        break;
      }
      default:
        // No-op for other event types — Stripe wants a 200 ack regardless.
        break;
    }

    return { received: true };
  },
};
