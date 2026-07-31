import { query } from '../db';
import { isIdVerificationRequired } from '../config/verification-gate';
import {
    evaluateAdultAssuranceAccess,
    isAdultAssuranceGateEnabled,
} from '../config/adult-assurance-gate';

type QueryResult = { rows: any[]; rowCount?: number | null };
type QueryFn = (text: string, values?: unknown[]) => Promise<QueryResult>;

interface InteractionOptions {
  requireMatch?: boolean;
}

interface AccessState {
  actor_verified: boolean;
  target_verified: boolean;
  blocked: boolean;
  matched: boolean;
  target_visible: boolean;
  target_ghost: boolean;
}

export class SecurityError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export function createAccessControl(runQuery: QueryFn) {
  async function getState(actorId: string, targetId: string): Promise<AccessState> {
    const result = await runQuery(
      `SELECT
         COALESCE(actor.is_verified, FALSE) AS actor_verified,
         COALESCE(target.is_verified, FALSE) AS target_verified,
         EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = $2)
              OR (b.blocker_id = $2 AND b.blocked_id = $1)
         ) AS blocked,
         EXISTS (
           SELECT 1 FROM likes l1
           JOIN likes l2
             ON l2.liker_id = l1.liked_id
            AND l2.liked_id = l1.liker_id
           WHERE l1.liker_id = $1 AND l1.liked_id = $2
         ) AS matched,
         COALESCE(profile.is_visible, FALSE) AS target_visible,
         COALESCE(profile.is_ghost, FALSE) AS target_ghost
       FROM users actor
       LEFT JOIN users target ON target.id = $2
       LEFT JOIN profiles profile ON profile.user_id = target.id
       WHERE actor.id = $1`,
      [actorId, targetId],
    );

    if (!result.rows[0]) {
      throw new SecurityError('account_unavailable', 401, 'Account unavailable');
    }
    return result.rows[0] as AccessState;
  }

  return {
    async requireVerified(userId: string): Promise<void> {
      if (!isIdVerificationRequired()) return;
      const result = await runQuery(
        `SELECT COALESCE(is_verified, FALSE) AS actor_verified
         FROM users
         WHERE id = $1`,
        [userId],
      );
      if (!result.rows[0]?.actor_verified) {
        throw new SecurityError(
          'verification_required',
          403,
          'Identity verification is required',
        );
      }
    },

        async requireAdultAssurance(userId: string): Promise<void> {
                if (!isAdultAssuranceGateEnabled()) return;
                const [userResult, configResult] = await Promise.all([
                          runQuery(
                                      `SELECT age_assurance_status, created_at FROM users WHERE id = $1`,
                                      [userId],
                                    ),
                          runQuery(
                                      `SELECT enforcement_started_at, grace_period_days FROM adult_assurance_config LIMIT 1`,
                                      [],
                                    ),
                        ]);
                const userRow = userResult.rows[0];
                if (!userRow) {
                          throw new SecurityError('account_unavailable', 401, 'Account unavailable');
                }
                const configRow = configResult.rows[0];
                if (!configRow) {
                          // Fail closed: a missing config row must never be read as "no gate".
                          throw new SecurityError(
                                      'adult_assurance_required',
                                      403,
                                      'Adult assurance is required',
                                    );
                }
                const decision = evaluateAdultAssuranceAccess({
                          ageAssuranceStatus: userRow.age_assurance_status,
                          accountCreatedAt: new Date(userRow.created_at),
                          now: new Date(),
                          config: {
                                      enforcementStartedAt: new Date(configRow.enforcement_started_at),
                                      gracePeriodDays: Number(configRow.grace_period_days),
                          },
                });
                if (!decision.allowed) {
                          throw new SecurityError(
                                      'adult_assurance_required',
                                      403,
                                      'Adult assurance is required',
                                    );
                }
        },

    async assertInteraction(
      actorId: string,
      targetId: string,
      options: InteractionOptions = {},
    ): Promise<void> {
      if (!targetId || actorId === targetId) {
        throw new SecurityError('invalid_target', 400, 'Invalid interaction target');
      }
      const state = await getState(actorId, targetId);
      const gateOn = isIdVerificationRequired();
      if (gateOn && !state.actor_verified) {
        throw new SecurityError(
          'verification_required',
          403,
          'Identity verification is required',
        );
      }
      if (gateOn && !state.target_verified) {
        throw new SecurityError('target_unavailable', 404, 'User unavailable');
      }
      if (state.blocked) {
        throw new SecurityError('interaction_blocked', 403, 'Interaction is blocked');
      }
      if (options.requireMatch && !state.matched) {
        throw new SecurityError('match_required', 403, 'A mutual match is required');
      }
    },

    async assertProfileView(actorId: string, targetId: string): Promise<void> {
      if (actorId === targetId) {
        return this.requireVerified(actorId);
      }
      const state = await getState(actorId, targetId);
      const gateOn = isIdVerificationRequired();
      if (gateOn && !state.actor_verified) {
        throw new SecurityError(
          'verification_required',
          403,
          'Identity verification is required',
        );
      }
      if (gateOn && !state.target_verified) {
        throw new SecurityError('target_unavailable', 404, 'User unavailable');
      }
      if (state.blocked) {
        throw new SecurityError('interaction_blocked', 403, 'Interaction is blocked');
      }

      if (state.target_visible && !state.target_ghost) {
        return;
      }
      if (state.matched) {
        return;
      }

      const relationship = await runQuery(
        `SELECT EXISTS (
           SELECT 1 FROM likes
           WHERE (liker_id = $1 AND liked_id = $2) OR (liker_id = $2 AND liked_id = $1)
         ) OR EXISTS (
           SELECT 1 FROM messages
           WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
         ) AS allowed`,
        [actorId, targetId],
      );
      if (relationship.rows[0]?.allowed) {
        return;
      }

      throw new SecurityError('profile_unavailable', 404, 'Profile unavailable');
    },
  };
}

export const accessControl = createAccessControl(query);
