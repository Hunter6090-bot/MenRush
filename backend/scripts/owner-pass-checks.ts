/**
 * Owner-account pass (two owner accounts): profile load + 1:1 reply send.
 * Read/write only on test thread between known accounts — does not strip Premium.
 *
 * Member ids come from the environment only (never hardcoded, never printed):
 *   OWNER_PASS_USER_ID    user id of the first owner account
 *   OWNER_PASS_PEER_USER_ID  user id of the second owner account
 * Exits 2 with a message if either is unset or not a UUID. Not run in CI.
 *   OWNER_PASS_USER_ID=... OWNER_PASS_PEER_USER_ID=... railway run --service backend -- \
 *     npx ts-node --transpile-only scripts/owner-pass-checks.ts
 */
import 'dotenv/config';
import { messageService } from '../src/services/message.service';
import { userService } from '../src/services/user.service';
import pool from '../src/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function memberIdFromEnv(name: 'OWNER_PASS_USER_ID' | 'OWNER_PASS_PEER_USER_ID'): string {
  const value = process.env[name]?.trim();
  if (!value || !UUID_RE.test(value)) {
    console.error(`${name} is ${value ? 'not a UUID' : 'not set'}. Set it in the environment to run this owner pass.`);
    process.exit(2);
  }
  return value;
}

const OWNER = memberIdFromEnv('OWNER_PASS_USER_ID');
const PEER = memberIdFromEnv('OWNER_PASS_PEER_USER_ID');

async function main() {
  const profile = await userService.getPublicProfile(OWNER, PEER);
  if (!profile?.id || !profile?.name) {
    throw new Error('owner_profile_blank');
  }
  if (profile.interests != null && !Array.isArray(profile.interests)) {
    throw new Error('interests_not_array');
  }
  console.log('ok owner_profile_load', {
    name: profile.name,
    interestCount: Array.isArray(profile.interests) ? profile.interests.length : 0,
  });

  const body = `owner-pass-${Date.now()}`;
  const sent = await messageService.sendMessage(OWNER, PEER, body);
  if (!sent?.id || sent.message !== body) {
    throw new Error('owner_reply_send_failed');
  }
  console.log('ok owner_reply_send', { id: sent.id });
  console.log(JSON.stringify({ ok: true, owner: 'owner-pass' }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
