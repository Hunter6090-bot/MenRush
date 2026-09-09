/**
 * Import Hot Spots from a local JSON/CSV export (ops / first-party curation only).
 *
 * Commercial venues only (saunas / nightlife / bars / cinema). Outdoor, parks,
 * parking, transit, rest-facilities, and PSE-coded rows are rejected.
 *
 * Never invent lat/lng. Never scrape competitor sites from CI. Prefer venue-supplied
 * or hand-verified coordinates. See docs/commercial-venue-hot-spots.md.
 *
 * Freshness rule (legacy community exports): skip rows with no check-in OR comment
 * activity within the last 30 days when those fields are present.
 *
 * Usage:
 *   npm run hotspots:import -- --file /path/to/venues.json --dry-run
 *   npm run hotspots:seed-commercial -- --file ./data/commercial-venues.sample.json --dry-run
 *
 * Preferred commercial JSON shape:
 *   {
 *     "name": "Sweatbox Soho",
 *     "city": "London",
 *     "lat": 51.5132,
 *     "lng": -0.1391,
 *     "category": "saunas",
 *     "nation": "England",
 *     "source_url": "https://example.com",
 *     "externalId": "ops-sweatbox-soho"
 *   }
 */
import fs from 'fs';
import path from 'path';
import pool from '../src/db';
import { COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS } from '../src/services/hot-spots.service';

const FRESHNESS_DAYS = 30;

const ALLOWED = new Set<string>(COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS);

const CATEGORY_ALIASES: Record<string, string> = {
  sauna: 'saunas',
  saunas: 'saunas',
  spa: 'saunas',
  bathhouse: 'saunas',
  club: 'nightlife',
  nightlife: 'nightlife',
  bar: 'bars',
  bars: 'bars',
  cinema: 'cinema',
  'cinema-club': 'cinema',
  'cinema_club': 'cinema',
};

const RED_REJECT =
  /cottage|cottaging|glory\s*hole|truck\s*stop|cruising\s*area|nude\s*beach|public\s*toilet|pse\b|outdoor\s*play|known\s*cruising|redruth/i;

type ImportSpot = {
  name: string;
  city?: string | null;
  lat: number;
  lng: number;
  category?: string | null;
  description?: string | null;
  externalId?: string | null;
  lastActivity?: string | null;
  lastCheckin?: string | null;
  lastComment?: string | null;
};

type Args = {
  file: string;
  source: string;
  dryRun: boolean;
  freshnessDays: number;
};

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let file = '';
  let source = 'squirt-import';
  let dryRun = false;
  let freshnessDays = FRESHNESS_DAYS;

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
    } else if (arg === '--freshness-days') {
      const parsed = parseInt(args[i + 1] || '', 10);
      if (Number.isFinite(parsed) && parsed > 0) freshnessDays = parsed;
      i += 1;
    }
  }

  if (!file) {
    throw new Error(
      'Missing --file <path>. Example: npm run hotspots:import -- --file ./exports/spots.json',
    );
  }

  return { file: path.resolve(file), source, dryRun, freshnessDays };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseCsv(text: string): ImportSpot[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const nameI = idx(['name', 'title', 'spot', 'spotname']);
  const cityI = idx(['city', 'town', 'area']);
  const latI = idx(['lat', 'latitude']);
  const lngI = idx(['lng', 'lon', 'long', 'longitude']);
  const catI = idx(['category', 'cat', 'type', 'categoryslug']);
  const descI = idx(['description', 'desc', 'notes']);
  const extI = idx(['externalid', 'id', 'sourceid', 'squirtid']);
  const actI = idx(['lastactivity', 'activityat', 'updatedat']);
  const checkI = idx(['lastcheckin', 'lastcheckinat', 'checkin']);
  const commentI = idx(['lastcomment', 'lastcommentat', 'comment']);

  if (nameI < 0 || latI < 0 || lngI < 0) {
    throw new Error('CSV must include name, lat, lng columns');
  }

  const spots: ImportSpot[] = [];
  for (let r = 1; r < lines.length; r += 1) {
    const cells = splitCsvLine(lines[r]);
    const lat = parseFloat(cells[latI] || '');
    const lng = parseFloat(cells[lngI] || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    spots.push({
      name: cells[nameI] || '',
      city: cityI >= 0 ? cells[cityI] || null : null,
      lat,
      lng,
      category: catI >= 0 ? cells[catI] || null : null,
      description: descI >= 0 ? cells[descI] || null : null,
      externalId: extI >= 0 ? cells[extI] || null : null,
      lastActivity: actI >= 0 ? cells[actI] || null : null,
      lastCheckin: checkI >= 0 ? cells[checkI] || null : null,
      lastComment: commentI >= 0 ? cells[commentI] || null : null,
    });
  }
  return spots;
}

function parseJson(text: string): ImportSpot[] {
  const raw = JSON.parse(text) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { spots?: unknown }).spots)
      ? (raw as { spots: unknown[] }).spots
      : null;
  if (!list) throw new Error('JSON must be an array or { spots: [...] }');

  return list.map((item) => {
    const o = item as Record<string, unknown>;
    const lat = Number(o.lat ?? o.latitude);
    const lng = Number(o.lng ?? o.lon ?? o.long ?? o.longitude);
    return {
      name: String(o.name ?? o.title ?? ''),
      city: o.city != null ? String(o.city) : null,
      lat,
      lng,
      category: o.category != null ? String(o.category) : o.type != null ? String(o.type) : null,
      description: o.description != null ? String(o.description) : null,
      externalId:
        o.externalId != null
          ? String(o.externalId)
          : o.external_id != null
            ? String(o.external_id)
            : o.id != null
              ? String(o.id)
              : null,
      lastActivity:
        o.lastActivity != null
          ? String(o.lastActivity)
          : o.last_activity != null
            ? String(o.last_activity)
            : null,
      lastCheckin:
        o.lastCheckin != null
          ? String(o.lastCheckin)
          : o.last_checkin != null
            ? String(o.last_checkin)
            : null,
      lastComment:
        o.lastComment != null
          ? String(o.lastComment)
          : o.last_comment != null
            ? String(o.last_comment)
            : null,
    };
  });
}

function resolveActivity(spot: ImportSpot): Date | null {
  const candidates = [spot.lastActivity, spot.lastCheckin, spot.lastComment]
    .filter(Boolean)
    .map((s) => new Date(String(s)));
  const valid = candidates.filter((d) => !Number.isNaN(d.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
}

function resolveCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const mapped =
    CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[key.replace(/\s+/g, '-')] ?? key;
  return ALLOWED.has(mapped) ? mapped : null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.file)) {
    throw new Error(`File not found: ${args.file}`);
  }

  const text = fs.readFileSync(args.file, 'utf8');
  const ext = path.extname(args.file).toLowerCase();
  const spots = ext === '.csv' ? parseCsv(text) : parseJson(text);

  const cutoff = Date.now() - args.freshnessDays * 24 * 60 * 60 * 1000;
  const fresh: Array<ImportSpot & { activityAt: Date; categorySlug: string }> = [];
  let skippedStale = 0;
  let skippedInvalid = 0;
  let skippedRed = 0;

  for (const spot of spots) {
    if (!spot.name?.trim() || !Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) {
      skippedInvalid += 1;
      continue;
    }
    if (spot.lat < -90 || spot.lat > 90 || spot.lng < -180 || spot.lng > 180) {
      skippedInvalid += 1;
      continue;
    }
    if (
      RED_REJECT.test(spot.name) ||
      RED_REJECT.test(String(spot.city || '')) ||
      RED_REJECT.test(String(spot.description || '')) ||
      RED_REJECT.test(String(spot.category || ''))
    ) {
      skippedRed += 1;
      continue;
    }
    const categorySlug = resolveCategory(spot.category);
    if (!categorySlug) {
      skippedRed += 1;
      continue;
    }
    const activityAt = resolveActivity(spot);
    // Commercial ops rows without activity stamps are allowed (first-party curated).
    const activity =
      activityAt ??
      (args.source.includes('ops') || args.source.includes('commercial')
        ? new Date()
        : null);
    if (!activity || activity.getTime() < cutoff) {
      skippedStale += 1;
      continue;
    }
    fresh.push({ ...spot, activityAt: activity, categorySlug });
  }

  console.log(
    `[hotspots:import] loaded=${spots.length} fresh=${fresh.length} stale_skipped=${skippedStale} invalid_skipped=${skippedInvalid} red_skipped=${skippedRed} freshness_days=${args.freshnessDays} dry_run=${args.dryRun}`,
  );

  if (args.dryRun) {
    for (const s of fresh.slice(0, 20)) {
      console.log(`  + ${s.name} (${s.city ?? '?'}) @ ${s.lat},${s.lng} last=${s.activityAt.toISOString()}`);
    }
    if (fresh.length > 20) console.log(`  … and ${fresh.length - 20} more`);
    await pool.end();
    return;
  }

  const catRes = await pool.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM hot_spot_categories WHERE is_commercial = TRUE`,
  );
  const catBySlug = new Map(catRes.rows.map((r) => [r.slug, r.id]));

  let inserted = 0;
  let updated = 0;

  for (const spot of fresh) {
    const slug = spot.categorySlug;
    const categoryId = catBySlug.get(slug);
    if (!categoryId) {
      skippedRed += 1;
      continue;
    }

    const externalId = spot.externalId?.trim() || null;
    const name = spot.name.trim().slice(0, 120);
    const city = spot.city?.trim().slice(0, 60) || null;
    const description =
      spot.description?.trim() ||
      `Commercial venue. Follow the venue's rules. MenRush does not run this place.`;

    if (externalId) {
      const existing = await pool.query(
        `SELECT id FROM hot_spots WHERE source = $1 AND external_id = $2`,
        [args.source, externalId],
      );
      if (existing.rows[0]) {
        await pool.query(
          `UPDATE hot_spots
              SET name = $1, city = $2, description = $3,
                  latitude = $4, longitude = $5, category_id = $6,
                  last_activity_at = $7, is_active = TRUE, is_user_generated = FALSE,
                  venue_type = COALESCE(venue_type, $8)
            WHERE id = $9`,
          [
            name,
            city,
            description,
            spot.lat,
            spot.lng,
            categoryId,
            spot.activityAt.toISOString(),
            slug.replace(/s$/, ''),
            existing.rows[0].id,
          ],
        );
        updated += 1;
        continue;
      }
    } else {
      const existing = await pool.query(
        `SELECT id FROM hot_spots
          WHERE name = $1 AND COALESCE(city, '') = COALESCE($2, '')`,
        [name, city],
      );
      if (existing.rows[0]) {
        await pool.query(
          `UPDATE hot_spots
              SET description = COALESCE($1, description),
                  latitude = $2, longitude = $3, category_id = $4,
                  last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), $5::timestamptz),
                  is_active = TRUE
            WHERE id = $6`,
          [
            description,
            spot.lat,
            spot.lng,
            categoryId,
            spot.activityAt.toISOString(),
            existing.rows[0].id,
          ],
        );
        updated += 1;
        continue;
      }
    }

    await pool.query(
      `INSERT INTO hot_spots (
         category_id, name, city, description, latitude, longitude,
         is_user_generated, is_active, source, external_id, last_activity_at, venue_type
       ) VALUES ($1,$2,$3,$4,$5,$6,FALSE,TRUE,$7,$8,$9,$10)`,
      [
        categoryId,
        name,
        city,
        description,
        spot.lat,
        spot.lng,
        args.source,
        externalId,
        spot.activityAt.toISOString(),
        slug.replace(/s$/, ''),
      ],
    );
    inserted += 1;
  }

  console.log(`[hotspots:import] inserted=${inserted} updated=${updated}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('[hotspots:import] failed:', err instanceof Error ? err.message : err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
