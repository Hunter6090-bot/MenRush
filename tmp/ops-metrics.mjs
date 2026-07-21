import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function one(sql) {
  const { rows } = await pool.query(sql);
  return rows[0]?.n ?? 0;
}

try {
  const out = {
    users: await one('SELECT COUNT(*)::int AS n FROM users'),
    verified: await one('SELECT COUNT(*)::int AS n FROM users WHERE is_verified = TRUE'),
    withPhoto: await one("SELECT COUNT(*)::int AS n FROM users WHERE photo_url IS NOT NULL AND photo_url <> ''"),
    withLocation: await one('SELECT COUNT(*)::int AS n FROM profiles WHERE lat IS NOT NULL AND lng IS NOT NULL'),
    recent7: await one("SELECT COUNT(*)::int AS n FROM users WHERE created_at > NOW() - INTERVAL '7 days'"),
    recent30: await one("SELECT COUNT(*)::int AS n FROM users WHERE created_at > NOW() - INTERVAL '30 days'"),
    stuckNoProfile: await one('SELECT COUNT(*)::int AS n FROM users u WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id)'),
    stuckNoLocation: await one('SELECT COUNT(*)::int AS n FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.lat IS NULL OR p.lng IS NULL'),
    stuckNoPhoto: await one("SELECT COUNT(*)::int AS n FROM users WHERE photo_url IS NULL OR photo_url = ''"),
    online: await one('SELECT COUNT(*)::int AS n FROM profiles WHERE online = TRUE'),
    likes: await one('SELECT COUNT(*)::int AS n FROM likes'),
    messages: await one('SELECT COUNT(*)::int AS n FROM messages'),
    signupByDay: (await pool.query(
      "SELECT DATE(created_at) AS day, COUNT(*)::int AS n FROM users GROUP BY 1 ORDER BY 1 DESC LIMIT 14",
    )).rows,
  };

  for (const [table, key] of [
    // Production table is `waitlist` (not waitlist_subscribers).
    ['waitlist', 'waitlist'],
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
    out.drip = (await pool.query(
      'SELECT campaign_key, COUNT(*)::int AS sent FROM waitlist_drip_sends GROUP BY campaign_key ORDER BY campaign_key',
    )).rows;
  } catch {
    out.drip = [];
  }

  console.log(JSON.stringify(out, null, 2));
} finally {
  await pool.end();
}