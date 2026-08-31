/**
 * Owner-account pass (BOA90 ↔ Bigbear25): profile load + 1:1 reply send.
 * Read/write only on test thread between known accounts — does not strip Premium.
 */
import 'dotenv/config';
import { messageService } from '../src/services/message.service';
import { userService } from '../src/services/user.service';
import pool from '../src/db';

const BOA90 = '6e9b68ad-7d20-46fc-be94-3c2ac3fa16b9';
const BIGBEAR = 'be91f22f-83ba-40fb-9de4-b39c5ecdf6ae';

async function main() {
  const profile = await userService.getPublicProfile(BOA90, BIGBEAR);
  if (!profile?.id || !profile?.name) {
    throw new Error('boa90_profile_blank');
  }
  if (profile.interests != null && !Array.isArray(profile.interests)) {
    throw new Error('interests_not_array');
  }
  console.log('ok boa90_profile_load', {
    name: profile.name,
    interestCount: Array.isArray(profile.interests) ? profile.interests.length : 0,
  });

  const body = `boa90-owner-pass-${Date.now()}`;
  const sent = await messageService.sendMessage(BOA90, BIGBEAR, body);
  if (!sent?.id || sent.message !== body) {
    throw new Error('boa90_reply_send_failed');
  }
  console.log('ok boa90_reply_send', { id: sent.id });
  console.log(JSON.stringify({ ok: true, owner: 'BOA90' }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
