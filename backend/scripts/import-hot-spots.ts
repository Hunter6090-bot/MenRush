/**
 * Import Hot Spots from a Squirt-style (or similar) JSON/CSV export.
 *
 * Freshness rule: skip any spot with no check-in OR comment activity
 * within the last 30 days (`lastActivity` / `last_checkin` / `last_comment`).
 *
 * Credentials: never hardcode. Optional scrape helpers may read SQUIRT_EMAIL /
 * SQUIRT_PASSWORD / SQUIRT_SESSION from the environment — this script itself
 * only imports a local file you already exported.
 *
 * Usage:
 *   npm run hotspots:import -- --file /path/to/spots.json
 *   npm run hotspots:import -- --file /path/to/spots.csv --source squirt --dry-run
 *
 * JSON shape (array or { spots: [...] }):
 *   {
 *     "name": "Hampstead Heath",
 *     "city": "London",
 *     "lat": 51.5613,
 *     "lng": -0.1722,
 *     "category": "open-spaces",
 *     "description": optional,
 *     "externalId": optional unique id from source,
 *     "lastActivity": "2026-07-01T12:00:00Z",
 *     "lastCheckin": optional ISO date,
 *     "lastComment": optional ISO date
 *   }
 */
import fs from 'fs';
import path from 'path';
import pool from '../src/db';

const FRESHNESS_DAYS = 30;

const CATEGORY_ALIASES: Record<string, string> = {
  sauna: 'saunas',
  saunas: 'saunas',
  spa: 'saunas',
  bathhouse: 'saunas',
  park: 'parks-trails',
  parks: 'parks-trails',
  'parks-trails': 'parks-trails',
  trail: 'parks-trails',
  trails: 'parks-trails',
  common: 'open-spaces',
  commons: 'open-spaces',
  'open-spaces': 'open-spaces',
  heath: 'open-spaces',
  outdoor: 'open-spaces',
  parking: 'parking',
  'car park': 'parking',
  carpark: 'parking',
  transit: 'transit',
  station: 'transit',
  stations: 'transit',
  rest: 'rest-facilities',
  'rest-facilities': 'rest-facilities',
  toilets: 'rest-facilities',
  amenities: 'rest-facilities',
};

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

function resolveCategory(raw: string | null | undefined): string {
  if (!raw) return 'open-spaces';
  const key = raw.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[key.replace(/\s+/g, '-')] ?? 'open-spaces';
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
  const fresh: Array<ImportSpot & { activityAt: Date }> = [];
  let skippedStale = 0;
  let skippedInvalid = 0;

  for (const spot of spots) {
    if (!spot.name?.trim() || !Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) {
      skippedInvalid += 1;
      continue;
    }
    if (spot.lat < -90 || spot.lat > 90 || spot.lng < -180 || spot.lng > 180) {
      skippedInvalid += 1;
      continue;
    }
    const activityAt = resolveActivity(spot);
    if (!activityAt || activityAt.getTime() < cutoff) {
      skippedStale += 1;
      continue;
    }
    fresh.push({ ...spot, activityAt });
  }

  console.log(
    `[hotspots:import] loaded=${spots.length} fresh=${fresh.length} stale_skipped=${skippedStale} invalid_skipped=${skippedInvalid} freshness_days=${args.freshnessDays} dry_run=${args.dryRun}`,
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
    `SELECT id, slug FROM hot_spot_categories`,
  );
  const catBySlug = new Map(catRes.rows.map((r) => [r.slug, r.id]));

  let inserted = 0;
  let updated = 0;

  for (const spot of fresh) {
    const slug = resolveCategory(spot.category);
    const categoryId = catBySlug.get(slug) ?? catBySlug.get('open-spaces');
    if (!categoryId) throw new Error('hot_spot_categories missing — run migrations first');

    const externalId = spot.externalId?.trim() || null;
    const name = spot.name.trim().slice(0, 120);
    const city = spot.city?.trim().slice(0, 60) || null;
    const description = spot.description?.trim() || null;

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
                  last_activity_at = $7, is_active = TRUE, is_user_generated = TRUE
            WHERE id = $8`,
          [
            name,
            city,
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
      `INSERT INTO hot_spots
         (category_id, name, city, description, latitude, longitude,
          is_user_generated, source, external_id, last_activity_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, TRUE)`,
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
      ],
    );
    inserted += 1;
  }

  console.log(`[hotspots:import] inserted=${inserted} updated=${updated} source=${args.source}`);
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
