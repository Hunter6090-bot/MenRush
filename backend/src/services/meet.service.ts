import { query } from '../db';
import { accessControl } from '../security/access';

function orderPair(userId: string, peerId: string): { userA: string; userB: string; selfIsA: boolean } {
  if (userId < peerId) {
    return { userA: userId, userB: peerId, selfIsA: true };
  }
  return { userA: peerId, userB: userId, selfIsA: false };
}

export type MeetAgreementState = {
  my_confirmed: boolean;
  peer_confirmed: boolean;
  mutual: boolean;
  my_confirmed_at: string | null;
  peer_confirmed_at: string | null;
};

export const meetService = {
  async getState(userId: string, peerId: string): Promise<MeetAgreementState> {
    await accessControl.assertInteraction(userId, peerId, { requireMatch: true });
    const { userA, userB, selfIsA } = orderPair(userId, peerId);

    const result = await query(
      `SELECT user_a_confirmed_at, user_b_confirmed_at
       FROM meet_agreements
       WHERE user_a = $1 AND user_b = $2`,
      [userA, userB],
    );

    const row = result.rows[0];
    const aAt = row?.user_a_confirmed_at ?? null;
    const bAt = row?.user_b_confirmed_at ?? null;
    const myAt = selfIsA ? aAt : bAt;
    const peerAt = selfIsA ? bAt : aAt;

    return {
      my_confirmed: !!myAt,
      peer_confirmed: !!peerAt,
      mutual: !!aAt && !!bAt,
      my_confirmed_at: myAt,
      peer_confirmed_at: peerAt,
    };
  },

  async confirm(userId: string, peerId: string): Promise<MeetAgreementState> {
    await accessControl.assertInteraction(userId, peerId, { requireMatch: true });
    const { userA, userB, selfIsA } = orderPair(userId, peerId);
    const col = selfIsA ? 'user_a_confirmed_at' : 'user_b_confirmed_at';

    await query(
      `INSERT INTO meet_agreements (user_a, user_b, ${col}, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_a, user_b) DO UPDATE SET
         ${col} = COALESCE(meet_agreements.${col}, NOW()),
         updated_at = NOW()`,
      [userA, userB],
    );

    return this.getState(userId, peerId);
  },

  async revoke(userId: string, peerId: string): Promise<MeetAgreementState> {
    await accessControl.assertInteraction(userId, peerId, { requireMatch: true });
    const { userA, userB, selfIsA } = orderPair(userId, peerId);
    const col = selfIsA ? 'user_a_confirmed_at' : 'user_b_confirmed_at';

    await query(
      `INSERT INTO meet_agreements (user_a, user_b, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_a, user_b) DO UPDATE SET
         ${col} = NULL,
         updated_at = NOW()`,
      [userA, userB],
    );

    return this.getState(userId, peerId);
  },
};
