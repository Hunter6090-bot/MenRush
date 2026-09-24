/**
 * Ops seed: curated outdoor Hot Spots.
 *
 * Override batch (Al residual-risk 2026-09-12): Product may seed the South-first
 * ~121 list with --allow-reactivate. Legal colour stays RED (not a sign-off).
 * Soft-inactive Batch 1 (`ops-curated-batch1-2026-09:*`) stays inactive unless a
 * row appears in the override JSON (name match may rewrite external_id + reactivate).
 *
 * Do NOT invent missing ~1100 CSV names. Do NOT run prod seed until Al greens
 * South-first vs wait-for-full-CSV. Scene chips Toilets/Car/Cruising stay hidden.
 *
 * Never invent lat/lng. Skip rows missing finite coordinates.
 * Descriptions: Public park / Woodland / Car park only.
 * Categories: parks-trails / open-spaces / parking.
 * Reject toilet / cottage / PSE wording.
 *
 * Usage:
 *   npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.override-2026-09-12.json --dry-run
 *   npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.override-2026-09-12.json --allow-reactivate
 *   npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.override-2026-09-12.json --allow-reactivate --external-id-prefix ops-curated-override-2026-09-12
 */
import fs from 'fs';
import path from 'path';
import pool from '../src/db';
import { OUTDOOR_HOT_SPOT_CATEGORY_SLUGS } from '../src/services/hot-spots.service';

const ALLOWED = new Set<string>(OUTDOOR_HOT_SPOT_CATEGORY_SLUGS);
const ALLOWED_DESCRIPTIONS = new Set(['Public park', 'Woodland', 'Car park']);
const DEFAULT_EXTERNAL_ID_PREFIX = 'ops-curated-override-2026-09-12';

const RED_REJECT =
  /\bcottage\b|\bcottaging\b|glory\s*hole|truck\s*stop|cruising\s*area|nude\s*beach|public\s*toilet|\btoilets?\b|\bpse\b|outdoor\s*play|known\s*cruising|\bsquirt\b|how-to|d-day museum.*toilet/i;

type SpotRow = {
  name: string;
  city: string;
  category: string;
  description: string;
  lat?: number | string | null;
  lng?: number | string | null;
  external_id?: string | null;
  nation?: string | null;
  last_activity_at?: string | null;
};

type Args = {
  file: string;
  dryRun: boolean;
  source: string;
  allowReactivate: boolean;
  externalIdPrefix: string;
};

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let file = '';
  let dryRun = false;
  let source = 'ops-curated';
  let allowReactivate = false;
  let externalIdPrefix = DEFAULT_EXTERNAL_ID_PREFIX;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '-f') {
      file = args[i + 1] || '';
      i += 1;
    } else if (arg === '--source') {
      source = args[i + 1] || source;
      i += 1;
    } else if (arg === '--external-id-prefix') {
      externalIdPrefix = (args[i + 1] || externalIdPrefix).replace(/:$/, '');
      i += 1;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--allow-reactivate') {
      allowReactivate = true;
    }
  }
  if (!file) {
    throw new Error(
      'Missing --file <path>. Example: npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.override-2026-09-12.json --dry-run',
    );
  }
  return {
    file: path.resolve(file),
    dryRun,
    source,
    allowReactivate,
    externalIdPrefix,
  };
}

function slugExternalId(name: string, prefix: string): string {
  return `${prefix}:${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)}`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.allowReactivate) {
    console.error(
      'Refused: outdoor seed requires Product --allow-reactivate (Al residual-risk override).\n' +
        'Batch 1 (`ops-curated-batch1-2026-09:*`) stays soft-inactive unless listed in the override file.\n' +
        'Do NOT invent missing CSV rows. Pass --allow-reactivate only after Al greens South-first seed.',
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(args.file, 'utf8')) as {
    spots?: SpotRow[];
    venues?: SpotRow[];
    _meta?: {
      skipped?: string[];
      external_id_prefix?: string;
      batch?: string;
    };
  };
  const spots = raw.spots || raw.venues || [];
  if (!Array.isArray(spots) || spots.length === 0) {
    throw new Error('JSON must contain non-empty spots[]');
  }

  const prefix =
    (raw._meta?.external_id_prefix || args.externalIdPrefix || DEFAULT_EXTERNAL_ID_PREFIX).replace(
      /:$/,
      '',
    );

  const catRes = await pool.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM hot_spot_categories WHERE slug = ANY($1::text[])`,
    [Array.from(ALLOWED)],
  );
  const catBySlug = new Map(catRes.rows.map((r) => [r.slug, r.id]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const spot of spots) {
    const name = (spot.name || '').trim();
    const city = (spot.city || '').trim();
    const category = (spot.category || '').trim();
    const description = (spot.description || '').trim();
    const lat = spot.lat == null || spot.lat === '' ? NaN : Number(spot.lat);
    const lng = spot.lng == null || spot.lng === '' ? NaN : Number(spot.lng);
    const externalId = (spot.external_id || '').trim() || slugExternalId(name, prefix);
    const nation = (spot.nation || 'England').trim() || 'England';

    if (!name || !city) {
      failures.push(`${name || '(missing name)'}: missing name/city`);
      skipped += 1;
      continue;
    }
    if (RED_REJECT.test(name) || RED_REJECT.test(description) || RED_REJECT.test(city)) {
      failures.push(`${name}: RED text rejected (toilet/cottage/PSE/cruising)`);
      skipped += 1;
      continue;
    }
    if (!ALLOWED.has(category)) {
      failures.push(`${name}: category must be parks-trails|open-spaces|parking (got ${category})`);
      skipped += 1;
      continue;
    }
    if (!ALLOWED_DESCRIPTIONS.has(description)) {
      failures.push(`${name}: description must be Public park|Woodland|Car park`);
      skipped += 1;
      continue;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      failures.push(`${name}: missing geocode — skipped (never invent coords)`);
      skipped += 1;
      continue;
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
      failures.push(`${name}: invalid lat/lng`);
      skipped += 1;
      continue;
    }

    const categoryId = catBySlug.get(category);
    if (!categoryId) {
      failures.push(`${name}: category slug not in DB: ${category}`);
      skipped += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(`[dry-run] ${name} @ ${city} ${lat},${lng} (${category}) ${externalId}`);
      inserted += 1;
      continue;
    }

    const isCruisingPin =
      externalId.startsWith('ops-curated-cruising:') ||
      name === 'A31 Hog’s Back Rest Lay-by' ||
      name === 'Wisley (Ockham Common)' ||
      /hog.*back/i.test(name) ||
      /wisley.*common|ockham.*common/i.test(name);

    const byExt = await pool.query(
      `SELECT hs.id, hs.last_activity_at, MAX(c.checked_in_at) AS latest_checkin
         FROM hot_spots hs
         LEFT JOIN hot_spot_checkins c ON c.spot_id = hs.id
        WHERE hs.source = $1 AND hs.external_id = $2
        GROUP BY hs.id, hs.last_activity_at`,
      [args.source, externalId],
    );
    if (byExt.rows[0]) {
      const existing = byExt.rows[0];
      const targetLastActivity =
        spot.last_activity_at !== undefined
          ? spot.last_activity_at ? new Date(spot.last_activity_at) : null
          : existing.latest_checkin
            ? new Date(existing.latest_checkin)
            : isCruisingPin ? null : existing.last_activity_at;

      await pool.query(
        `UPDATE hot_spots SET
           category_id = $2,
           name = $3,
           city = $4,
           nation = $5,
           description = $6,
           latitude = $7,
           longitude = $8,
           is_user_generated = FALSE,
           is_active = TRUE,
           verified_at = COALESCE(verified_at, NOW()),
           last_activity_at = $9
         WHERE id = $1`,
        [byExt.rows[0].id, categoryId, name, city, nation, description, lat, lng, targetLastActivity],
      );
      updated += 1;
      continue;
    }

    // Also match soft-inactive Batch 1 rows by prior external_id slug tail / name+city
    // so override can reactivate only names that appear in the new list.
    const byLegacyExt = await pool.query(
      `SELECT hs.id, hs.last_activity_at, MAX(c.checked_in_at) AS latest_checkin
         FROM hot_spots hs
         LEFT JOIN hot_spot_checkins c ON c.spot_id = hs.id
        WHERE hs.source = $1
          AND (
            hs.external_id = $2
            OR hs.external_id = ('ops-curated-batch1-2026-09:' || split_part($2, ':', 2))
          )
        GROUP BY hs.id, hs.last_activity_at
        LIMIT 1`,
      [args.source, externalId],
    );
    if (byLegacyExt.rows[0]) {
      const existing = byLegacyExt.rows[0];
      const targetLastActivity =
        spot.last_activity_at !== undefined
          ? spot.last_activity_at ? new Date(spot.last_activity_at) : null
          : existing.latest_checkin
            ? new Date(existing.latest_checkin)
            : isCruisingPin ? null : existing.last_activity_at;

      await pool.query(
        `UPDATE hot_spots SET
           category_id = $2,
           name = $3,
           city = $4,
           nation = $5,
           description = $6,
           latitude = $7,
           longitude = $8,
           is_user_generated = FALSE,
           is_active = TRUE,
           source = $9,
           external_id = $10,
           verified_at = COALESCE(verified_at, NOW()),
           last_activity_at = $11
         WHERE id = $1`,
        [
          byLegacyExt.rows[0].id,
          categoryId,
          name,
          city,
          nation,
          description,
          lat,
          lng,
          args.source,
          externalId,
          targetLastActivity,
        ],
      );
      updated += 1;
      continue;
    }

    const byName = await pool.query(
      `SELECT hs.id, hs.last_activity_at, MAX(c.checked_in_at) AS latest_checkin
         FROM hot_spots hs
         LEFT JOIN hot_spot_checkins c ON c.spot_id = hs.id
        WHERE hs.is_user_generated = FALSE
          AND lower(hs.city) = lower($1)
          AND (
            lower(hs.name) = lower($2)
            OR (
              lower($2) IN ('st. catherine''s hill', 'st catherine''s hill')
              AND lower(hs.name) IN ('st. catherine''s hill', 'st catherine''s hill')
            )
          )
        GROUP BY hs.id, hs.last_activity_at
        LIMIT 1`,
      [city, name],
    );
    if (byName.rows[0]) {
      const existing = byName.rows[0];
      const targetLastActivity =
        spot.last_activity_at !== undefined
          ? spot.last_activity_at ? new Date(spot.last_activity_at) : null
          : existing.latest_checkin
            ? new Date(existing.latest_checkin)
            : isCruisingPin ? null : existing.last_activity_at;

      await pool.query(
        `UPDATE hot_spots SET
           category_id = $2,
           name = $3,
           city = $4,
           nation = $5,
           description = $6,
           latitude = $7,
           longitude = $8,
           is_user_generated = FALSE,
           is_active = TRUE,
           source = $9,
           external_id = $10,
           verified_at = COALESCE(verified_at, NOW()),
           last_activity_at = $11
         WHERE id = $1`,
        [
          byName.rows[0].id,
          categoryId,
          name,
          city,
          nation,
          description,
          lat,
          lng,
          args.source,
          externalId,
          targetLastActivity,
        ],
      );
      updated += 1;
      continue;
    }

    // For new outdoor seed rows, never default last_activity_at to NOW().
    // Leave NULL unless a real check-in happened or an explicit non-null timestamp was specified in JSON.
    const initialLastActivity = spot.last_activity_at
      ? new Date(spot.last_activity_at)
      : null;

    await pool.query(
      `INSERT INTO hot_spots (
         category_id, name, city, nation, description,
         latitude, longitude, is_user_generated, is_active, source, external_id,
         verified_at, last_activity_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, FALSE, TRUE, $8, $9,
         NOW(), $10
       )`,
      [categoryId, name, city, nation, description, lat, lng, args.source, externalId, initialLastActivity],
    );
    inserted += 1;
  }

  console.log(
    `[hotspots:seed-outdoor] file=${args.file} dry_run=${args.dryRun} prefix=${prefix} inserted=${inserted} updated=${updated} skipped=${skipped}`,
  );
  if (failures.length) {
    console.log('[hotspots:seed-outdoor] failures:');
    for (const line of failures) console.log(`  - ${line}`);
  }
  if (raw._meta?.skipped?.length) {
    console.log('[hotspots:seed-outdoor] meta.skipped:', raw._meta.skipped.join(', '));
  }
}

main()
  .catch((err) => {
    console.error('[hotspots:seed-outdoor] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
