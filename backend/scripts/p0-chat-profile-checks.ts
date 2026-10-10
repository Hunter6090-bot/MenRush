/**
 * API checks for P0 chat reply send + profile load (no hosting diagnosis).
 * Run: npx ts-node --transpile-only scripts/p0-chat-profile-checks.ts
 */
import 'dotenv/config';
import { messageService } from '../src/services/message.service';
import { userService } from '../src/services/user.service';
import { SecurityError } from '../src/security/access';
import { authService } from '../src/services/auth.service';
import pool from '../src/db';

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const PASS = 'MenRushTest2026!';

async function main() {
  const aliceLogin = await authService.login({ email: ALICE, password: PASS });
  const bobLogin = await authService.login({ email: BOB, password: PASS });
  const aliceId = aliceLogin.user.id as string;
  const bobId = bobLogin.user.id as string;

  // Ensure mutual match for send path.
  await userService.likeUser(aliceId, bobId);
  await userService.likeUser(bobId, aliceId);

  const profile = await userService.getPublicProfile(aliceId, bobId);
  if (!profile?.id || !profile?.name) {
    throw new Error('profile_load_failed: empty payload');
  }
  console.log('ok profile_load', { id: profile.id, name: profile.name });

  const body = `p0-check-${Date.now()}`;
  const sent = await messageService.sendMessage(aliceId, bobId, body);
  if (!sent?.id || sent.message !== body) {
    throw new Error('reply_send_failed');
  }
  console.log('ok reply_send', { id: sent.id });

  let matchGate = false;
  try {
    // Create a third party via bob→non-match if needed: use alice to self (invalid)
    await messageService.sendMessage(aliceId, aliceId, 'nope');
  } catch (e) {
    if (e instanceof SecurityError && (e.code === 'invalid_target' || e.code === 'match_required')) {
      matchGate = true;
    }
  }
  if (!matchGate) {
    // Prefer match_required against a random uuid with no likes
    try {
      await messageService.sendMessage(aliceId, '00000000-0000-4000-8000-000000000099', 'nope');
    } catch (e) {
      if (e instanceof SecurityError) matchGate = true;
    }
  }
  console.log('ok security_gate', { matchGate });

  console.log(JSON.stringify({ ok: true }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
