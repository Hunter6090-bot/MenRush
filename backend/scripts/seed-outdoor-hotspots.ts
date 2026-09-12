/**
 * Ops seed: curated outdoor Hot Spots (Batch 1 — HISTORICAL).
 *
 * PUBLIC OFF (Al ORDER): outdoor Batch 1 is off the public map. Product deactivated
 * ops-curated-batch1-2026-09:* in production. Do NOT re-run this seed to re-activate.
 * This script refuses unless --allow-reactivate is passed (emergency only).
 *
 * Commercial importer rejects outdoor — use this script (or migration 057) only if Product
 * explicitly re-opens outdoor. Never invent lat/lng. Skip rows missing finite coordinates.
 * Descriptions: Public park / Woodland / Car park only.
 *
 * Usage (blocked by default):
 *   npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.batch1-2026-09.json --dry-run
 *   npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.batch1-2026-09.json --allow-reactivate
 */
import fs from 'fs';
import path from 'path';
import pool from '../src/db';
import { OUTDOOR_HOT_SPOT_CATEGORY_SLUGS } from '../src/services/hot-spots.service';

const ALLOWED = new Set<string>(OUTDOOR_HOT_SPOT_CATEGORY_SLUGS);
const ALLOWED_DESCRIPTIONS = new Set(['Public park', 'Woodland', 'Car park']);

const RED_REJECT =
  /\bcottage\b|\bcottaging\b|glory\s*hole|truck\s*stop|cruising\s*area|nude\s*beach|public\s*toilet|\bpse\b|outdoor\s*play|known\s*cruising|\bsquirt\b|how-to|d-day museum.*toilet/i;

type SpotRow = {
  name: string;
  city: string;
  category: string;
  description: string;
  lat?: number | string | null;
  lng?: number | string | null;
  external_id?: string | null;
  nation?: string | null;
};

type Args = { file: string; dryRun: boolean; source: string; allowReactivate: boolean };

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let file = '';
  let dryRun = false;
  let source = 'ops-curated';
  let allowReactivate = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '-f') {
      file = args[i + 1] || '';
      i += 1;
    } else if (arg === '--source') {
      source = args[i + 1] || source;
      i += 1;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--allow-reactivate') {
      allowReactivate = true;
    }
  }
  if (!file) {
    throw new Error(
      'Missing --file <path>. Example: npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.batch1-2026-09.json --dry-run',
    );
  }
  return { file: path.resolve(file), dryRun, source, allowReactivate };
}

function slugExternalId(name: string): string {
  return `ops-curated-batch1-2026-09:${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)}`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.allowReactivate) {
    console.error(
      'Refused: outdoor Batch 1 is PUBLIC OFF (Al ORDER). Do NOT re-run this seed to re-activate.\n' +
        'Public map is commercial-only. Pass --allow-reactivate only if Product explicitly re-opens outdoor.',
    );
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(args.file, 'utf8')) as {
    spots?: SpotRow[];
    venues?: SpotRow[];
    _meta?: { skipped?: string[] };
  };
  const spots = raw.spots || raw.venues || [];
  if (!Array.isArray(spots) || spots.length === 0) {
    throw new Error('JSON must contain non-empty spots[]');
  }

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
    const externalId = (spot.external_id || '').trim() || slugExternalId(name);
    const nation = (spot.nation || 'England').trim() || 'England';

    if (!name || !city) {
      failures.push(`${name || '(missing name)'}: missing name/city`);
      skipped += 1;
      continue;
    }
    if (RED_REJECT.test(name) || RED_REJECT.test(description)) {
      failures.push(`${name}: RED text rejected`);
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
      console.log(`[dry-run] ${name} @ ${city} ${lat},${lng} (${category})`);
      inserted += 1;
      continue;
    }

    const byExt = await pool.query(
      `SELECT id FROM hot_spots WHERE source = $1 AND external_id = $2`,
      [args.source, externalId],
    );
    if (byExt.rows[0]) {
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
           last_activity_at = NOW()
         WHERE id = $1`,
        [byExt.rows[0].id, categoryId, name, city, nation, description, lat, lng],
      );
      updated += 1;
      continue;
    }

    const byName = await pool.query(
      `SELECT id FROM hot_spots
        WHERE is_user_generated = FALSE
          AND lower(city) = lower($1)
          AND (
            lower(name) = lower($2)
            OR (
              lower($2) IN ('st. catherine''s hill', 'st catherine''s hill')
              AND lower(name) IN ('st. catherine''s hill', 'st catherine''s hill')
            )
          )
        LIMIT 1`,
      [city, name],
    );
    if (byName.rows[0]) {
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
           last_activity_at = NOW()
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
        ],
      );
      updated += 1;
      continue;
    }

    await pool.query(
      `INSERT INTO hot_spots (
         category_id, name, city, nation, description,
         latitude, longitude, is_user_generated, is_active, source, external_id,
         verified_at, last_activity_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, FALSE, TRUE, $8, $9,
         NOW(), NOW()
       )`,
      [categoryId, name, city, nation, description, lat, lng, args.source, externalId],
    );
    inserted += 1;
  }

  console.log(
    `[hotspots:seed-outdoor] file=${args.file} dry_run=${args.dryRun} inserted=${inserted} updated=${updated} skipped=${skipped}`,
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
