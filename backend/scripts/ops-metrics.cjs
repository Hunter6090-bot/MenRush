/**
 * MenRush production funnel snapshot.
 * Run: railway run --service backend node scripts/ops-metrics.cjs
 * Requires DATABASE_URL. Never logs PII.
 */
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function one(sql) {
  const { rows } = await pool.query(sql);
  return rows[0]?.n ?? 0;
}

(async () => {
  const out = {
    users: await one('SELECT COUNT(*)::int AS n FROM users'),
    verified: await one('SELECT COUNT(*)::int AS n FROM users WHERE is_verified = TRUE'),
    under18: await one('SELECT COUNT(*)::int AS n FROM users WHERE age < 18'),
    withPhoto: await one("SELECT COUNT(*)::int AS n FROM users WHERE photo_url IS NOT NULL AND photo_url <> ''"),
    genericAvatar: await one("SELECT COUNT(*)::int AS n FROM users WHERE photo_url LIKE '/avatars/generic/%'"),
    withLocation: await one('SELECT COUNT(*)::int AS n FROM profiles WHERE lat IS NOT NULL AND lng IS NOT NULL'),
    recent7: await one("SELECT COUNT(*)::int AS n FROM users WHERE created_at > NOW() - INTERVAL '7 days'"),
    recent30: await one("SELECT COUNT(*)::int AS n FROM users WHERE created_at > NOW() - INTERVAL '30 days'"),
    stuckNoProfile: await one(
      'SELECT COUNT(*)::int AS n FROM users u WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id)',
    ),
    stuckNoLocation: await one(
      'SELECT COUNT(*)::int AS n FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.lat IS NULL OR p.lng IS NULL',
    ),
    stuckNoPhoto: await one("SELECT COUNT(*)::int AS n FROM users WHERE photo_url IS NULL OR photo_url = ''"),
    fullMinProfile: await one(`
      SELECT COUNT(*)::int AS n FROM users
      WHERE length(trim(coalesce(bio,''))) >= 20
        AND looking_for IS NOT NULL AND trim(looking_for) <> ''
        AND interests IS NOT NULL AND cardinality(interests) >= 3
    `),
    online: await one('SELECT COUNT(*)::int AS n FROM profiles WHERE online = TRUE'),
    /** Matches Nearby "Active now" window (last_seen within 20 minutes). */
    onlineFresh: await one(`
      SELECT COUNT(*)::int AS n FROM profiles
      WHERE online = TRUE
        AND last_seen IS NOT NULL
        AND last_seen > NOW() - INTERVAL '20 minutes'
    `),
    likes: await one('SELECT COUNT(*)::int AS n FROM likes'),
    likes7d: await one("SELECT COUNT(*)::int AS n FROM likes WHERE created_at > NOW() - INTERVAL '7 days'"),
    messages: await one('SELECT COUNT(*)::int AS n FROM messages'),
    messages7d: await one("SELECT COUNT(*)::int AS n FROM messages WHERE created_at > NOW() - INTERVAL '7 days'"),
    notifications7d: await one(
      "SELECT COUNT(*)::int AS n FROM notifications WHERE created_at > NOW() - INTERVAL '7 days'",
    ),
    signupByDay: (
      await pool.query(
        "SELECT DATE(created_at) AS day, COUNT(*)::int AS n FROM users GROUP BY 1 ORDER BY 1 DESC LIMIT 14",
      )
    ).rows,
  };

  for (const [table, key] of [
    ['waitlist_subscribers', 'waitlist'],
    ['waitlist_drip_sends', 'dripTotal'],
    ['beta_invite_codes', 'betaInvites'],
  ]) {
    try {
      out[key] = await one(`SELECT COUNT(*)::int AS n FROM ${table}`);
    } catch {
      out[key] = null;
    }
  }

  try {
    out.drip = (
      await pool.query(
        'SELECT campaign_key, COUNT(*)::int AS sent FROM waitlist_drip_sends GROUP BY campaign_key ORDER BY campaign_key',
      )
    ).rows;
  } catch {
    out.drip = [];
  }

  console.log(JSON.stringify(out, null, 2));
  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
