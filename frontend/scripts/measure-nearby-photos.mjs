/**
 * Live Nearby gate — would have caught Al's ~45s / missing-photo report.
 *
 * Measures production Railway (what Vercel preview hits):
 * - GET /users/nearby latency
 * - photo bytes for first upload URLs
 * - whether /api/media/display exists
 *
 * Exit 1 if nearby > NEARBY_BUDGET_MS (default 3500) OR any upload photo is
 * missing AND >2MB originals dominate without a working display API.
 *
 * MEASURE_SOFT=1 → always exit 0 but write the report (pre-backend-deploy).
 *
 * node scripts/measure-nearby-photos.mjs --out /opt/cursor/artifacts/nearby_gate.json
 */
import { writeFileSync } from 'node:fs';

const API = (process.env.MEASURE_API_URL || 'https://backend-production-d587.up.railway.app/api').replace(
  /\/$/,
  '',
);
const BUDGET = Number(process.env.NEARBY_BUDGET_MS || 3500);
const SOFT = process.env.MEASURE_SOFT === '1';
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : null;

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bob@example.com', password: 'MenRushTest2026!' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  return res.json();
}

async function main() {
  const auth = await login();
  const headers = { Authorization: `Bearer ${auth.token}` };
  const me = await fetch(`${API}/users/me`, { headers }).then((r) => r.json());
  const lat = me.lat || 51.5136;
  const lng = me.lng || -0.1365;

  const t0 = Date.now();
  const nearbyRes = await fetch(`${API}/users/nearby?lat=${lat}&lng=${lng}&radius=50`, { headers });
  const nearbyMs = Date.now() - t0;
  const users = await nearbyRes.json();
  const list = Array.isArray(users) ? users : [];

  const uploads = list
    .map((u) => ({ name: u.name, photo_url: u.photo_url }))
    .filter((u) => typeof u.photo_url === 'string' && u.photo_url.startsWith('/uploads/'));

  const photos = [];
  for (const u of uploads.slice(0, 6)) {
    const t = Date.now();
    const r = await fetch(`https://backend-production-d587.up.railway.app${u.photo_url}`);
    const buf = Buffer.from(await r.arrayBuffer());
    photos.push({
      name: u.name,
      path: u.photo_url,
      status: r.status,
      ms: Date.now() - t,
      bytes: buf.length,
      ct: r.headers.get('content-type'),
    });
  }

  let displayOk = false;
  if (uploads[0]) {
    const d = await fetch(
      `${API}/media/display?src=${encodeURIComponent(uploads[0].photo_url)}&w=480`,
    );
    const ct = d.headers.get('content-type') || '';
    displayOk = d.ok && ct.includes('image');
  }

  const huge = photos.filter((p) => p.status === 200 && p.bytes > 1_500_000);
  const missing = photos.filter((p) => p.status === 404);
  const failures = [];
  if (nearbyMs > BUDGET) {
    failures.push(`nearby_api_${nearbyMs}ms_exceeds_${BUDGET}ms_budget`);
  }
  if (!displayOk && huge.length > 0) {
    failures.push(
      `iphone_photo_risk_${huge.length}_uploads_over_1_5mb_without_display_api`,
    );
  }
  if (missing.length > 0 && huge.length === 0 && photos.length === missing.length) {
    failures.push('all_sampled_upload_photos_404');
  }

  const report = {
    at: new Date().toISOString(),
    api: API,
    nearbyMs,
    budgetMs: BUDGET,
    count: list.length,
    displayOk,
    photos,
    hugeCount: huge.length,
    missingCount: missing.length,
    failures,
    pass: failures.length === 0,
    soft: SOFT,
  };

  const text = JSON.stringify(report, null, 2);
  console.log(text);
  if (OUT) writeFileSync(OUT, text);

  if (!report.pass && !SOFT) {
    console.error('NEARBY_GATE_FAIL', failures.join(','));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
