/**
 * Ops seed: commercial gay venues only (Cruise / Hot Spots).
 *
 * Legal locks:
 * - GREEN: saunas / clubs / bars / cinema clubs on private commercial premises
 * - RED: never seed outdoor, parks, cottaging, toilets, PSE, truck stops, etc.
 * - Never invent lat/lng. Never scrape competitor listings wholesale.
 * - No hours, prices, partnership claims, or fake check-in counts.
 *
 * Usage:
 *   npm run hotspots:seed-commercial -- --file ./data/commercial-venues.sample.json --dry-run
 *   npm run hotspots:seed-commercial -- --file /path/to/ops-verified-venues.json
 *
 * JSON shape: { "venues": [ { name, city, nation?, category, venue_type?,
 *   lat, lng, source_url?, external_id?, verified_at? } ] }
 */
import fs from 'fs';
import path from 'path';
import pool from '../src/db';
import { COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS } from '../src/services/hot-spots.service';

const ALLOWED = new Set<string>(COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS);

const CATEGORY_ALIASES: Record<string, string> = {
  sauna: 'saunas',
  saunas: 'saunas',
  spa: 'saunas',
  bathhouse: 'saunas',
  gym: 'saunas',
  club: 'nightlife',
  nightlife: 'nightlife',
  nightclub: 'nightlife',
  bar: 'bars',
  bars: 'bars',
  cafe: 'bars',
  restaurant: 'bars',
  hotel: 'bars',
  hotels: 'bars',
  cinema: 'cinema',
  theater: 'cinema',
  theatre: 'cinema',
  'video arcade': 'cinema',
  'video-arcade': 'cinema',
  'cinema-club': 'cinema',
  'cinema_club': 'cinema',
};

/** Explicit RED rejects — never import even if someone remaps aliases. */
const RED_REJECT =
  /cottage|cottaging|glory\s*hole|truck\s*stop|cruising\s*area|nude\s*beach|public\s*toilet|pse\b|outdoor\s*play|known\s*cruising|redruth/i;

type VenueRow = {
  name: string;
  city: string;
  nation?: string | null;
  category: string;
  venue_type?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  source_url?: string | null;
  external_id?: string | null;
  verified_at?: string | null;
  description?: string | null;
};

type Args = { file: string; dryRun: boolean; source: string };

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let file = '';
  let dryRun = false;
  let source = 'ops-commercial';
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
    }
  }
  if (!file) {
    throw new Error(
      'Missing --file <path>. Example: npm run hotspots:seed-commercial -- --file ./data/commercial-venues.sample.json --dry-run',
    );
  }
  return { file, dryRun, source };
}

function resolveCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? (ALLOWED.has(key) ? key : null);
}

function loadVenues(filePath: string): VenueRow[] {
  const abs = path.resolve(filePath);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as
    | { venues?: VenueRow[] }
    | VenueRow[];
  const list = Array.isArray(raw) ? raw : raw.venues ?? [];
  return list;
}

async function main() {
  const args = parseArgs(process.argv);
  const venues = loadVenues(args.file);

  const catRes = await pool.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM hot_spot_categories WHERE is_commercial = TRUE`,
  );
  const catBySlug = new Map(catRes.rows.map((r) => [r.slug, r.id]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const v of venues) {
    const name = (v.name || '').trim();
    const city = (v.city || '').trim();
    const slug = resolveCategory(v.category);

    if (!name || !city) {
      console.warn(`[skip] missing name/city: ${JSON.stringify(v)}`);
      skipped += 1;
      continue;
    }
    if (RED_REJECT.test(name) || RED_REJECT.test(city) || RED_REJECT.test(String(v.description || ''))) {
      console.warn(`[skip RED] ${name} (${city})`);
      skipped += 1;
      continue;
    }
    if (!slug || !ALLOWED.has(slug)) {
      console.warn(`[skip] non-commercial category for ${name}: ${v.category}`);
      skipped += 1;
      continue;
    }
    // Never invent coords. JSON null must not coerce via Number(null) === 0.
    if (v.lat == null || v.lng == null || v.lat === '' || v.lng === '') {
      console.warn(`[skip] missing lat/lng for ${name} (${city}) — never invent coordinates`);
      skipped += 1;
      continue;
    }
    const lat = Number(v.lat);
    const lng = Number(v.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn(`[skip] missing/invalid lat/lng for ${name} (${city}) — never invent coordinates`);
      skipped += 1;
      continue;
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.warn(`[skip] out-of-range coords for ${name}`);
      skipped += 1;
      continue;
    }
    // Reject 0,0 sentinel (common null-coercion mistake) for UK commercial venues.
    if (lat === 0 && lng === 0) {
      console.warn(`[skip] 0,0 coords for ${name} — refuse sentinel; never invent`);
      skipped += 1;
      continue;
    }

    const categoryId = catBySlug.get(slug);
    if (!categoryId) {
      console.warn(`[skip] category ${slug} missing — run migrations`);
      skipped += 1;
      continue;
    }

    const venueType = (v.venue_type || slug.replace(/s$/, '')).slice(0, 40);
    const nation = (v.nation || '').trim().slice(0, 40) || null;
    const sourceUrl = (v.source_url || '').trim() || null;
    const externalId = (v.external_id || `${city}:${name}`).slice(0, 120);
    const description =
      (v.description || '').trim() ||
      `Commercial venue. Follow the venue's rules. MenRush does not run this place.`;
    const verifiedAt = v.verified_at ? new Date(v.verified_at) : null;

    if (args.dryRun) {
      console.log(`[dry-run] ${name} @ ${city} (${slug}) ${lat},${lng}`);
      inserted += 1;
      continue;
    }

    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM hot_spots WHERE source = $1 AND external_id = $2`,
      [args.source, externalId],
    );

    if (existing.rows[0]) {
      await pool.query(
        `UPDATE hot_spots SET
           category_id = $2,
           name = $3,
           city = $4,
           nation = $5,
           venue_type = $6,
           source_url = $7,
           description = $8,
           latitude = $9,
           longitude = $10,
           verified_at = $11,
           is_active = TRUE,
           is_user_generated = FALSE
         WHERE id = $1`,
        [
          existing.rows[0].id,
          categoryId,
          name.slice(0, 120),
          city.slice(0, 60),
          nation,
          venueType,
          sourceUrl,
          description.slice(0, 500),
          lat,
          lng,
          verifiedAt,
        ],
      );
      updated += 1;
    } else {
      await pool.query(
        `INSERT INTO hot_spots (
           category_id, name, city, nation, venue_type, source_url, description,
           latitude, longitude, is_user_generated, is_active, source, external_id,
           verified_at, last_activity_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,TRUE,$10,$11,$12,NOW()
         )`,
        [
          categoryId,
          name.slice(0, 120),
          city.slice(0, 60),
          nation,
          venueType,
          sourceUrl,
          description.slice(0, 500),
          lat,
          lng,
          args.source,
          externalId,
          verifiedAt,
        ],
      );
      inserted += 1;
    }
  }

  console.log(
    `[hotspots:seed-commercial] file=${args.file} dry_run=${args.dryRun} inserted=${inserted} updated=${updated} skipped=${skipped}`,
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
