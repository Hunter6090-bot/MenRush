/**
 * One-shot: create two production test accounts for Wales video-call testing.
 * Run: cd backend && railway run -- node scripts/create-wales-test-users.js
 */
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

const accounts = [
  {
    email: 'wales-test@menrush.test',
    name: 'Wales Test',
    password: 'WalesCall2026!',
    lat: 51.4816,
    lng: -3.1791,
  },
  {
    email: 'wales-partner@menrush.test',
    name: 'Call Partner',
    password: 'WalesCall2026!',
    lat: 51.483,
    lng: -3.175,
  },
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });
  await client.connect();

  for (const a of accounts) {
    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(a.password, 10);
    await client.query(
      `INSERT INTO users (
         id, email, password_hash, name, age,
         is_verified, verification_status, verified_at,
         authenticity_status, authenticity_verified_at,
         age_assurance_status, age_assured_at,
         bio, looking_for, interests
       ) VALUES (
         $1, $2, $3, $4, 28,
         true, 'verified', NOW(),
         'verified', NOW(),
         'confirmed', NOW(),
         $5, $6, $7
       )
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         is_verified = true,
         verification_status = 'verified',
         verified_at = NOW(),
         authenticity_status = 'verified',
         age_assurance_status = 'confirmed',
         name = EXCLUDED.name`,
      [
        id,
        a.email,
        hash,
        a.name,
        'Beta video-call test account. Based in Wales.',
        'testing video calls',
        ['chat', 'meets', 'nights out'],
      ],
    );

    const userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [a.email]);
    const userId = userRes.rows[0].id;
    await client.query(
      `INSERT INTO profiles (user_id, lat, lng, location, online, last_seen, is_visible)
       VALUES (
         $1,
         $2::numeric,
         $3::numeric,
         ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography,
         true,
         NOW(),
         true
       )
       ON CONFLICT (user_id) DO UPDATE SET
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         location = EXCLUDED.location,
         online = true,
         last_seen = NOW(),
         is_visible = true`,
      [userId, a.lat, a.lng],
    );
    console.log(
      JSON.stringify({
        ok: true,
        email: a.email,
        password: a.password,
        name: a.name,
        id: userId,
      }),
    );
  }

  const a = await client.query(`SELECT id FROM users WHERE email = $1`, [accounts[0].email]);
  const b = await client.query(`SELECT id FROM users WHERE email = $1`, [accounts[1].email]);
  const idA = a.rows[0].id;
  const idB = b.rows[0].id;
  await client.query(
    `INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2), ($2, $1)
     ON CONFLICT DO NOTHING`,
    [idA, idB],
  );
  console.log(JSON.stringify({ matched: true }));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
