/**
 * One-shot geocoder for South-first override names (121).
 * Nominatim primary (Mapbox token in this env is not geocode-authorized).
 * Never invent coords — skip failures. Writes backend/data JSON.
 *
 * Usage: ./node_modules/.bin/ts-node scripts/geocode-outdoor-override-2026-09-12.ts
 */
import fs from 'fs';
import path from 'path';

const FAREHAM = { lat: 50.8548, lng: -1.1794 };
const EXTERNAL_PREFIX = 'ops-curated-override-2026-09-12';
const OUT = path.join(__dirname, '../data/outdoor-hotspots.override-2026-09-12.json');
const BATCH1 = path.join(__dirname, '../data/outdoor-hotspots.batch1-2026-09.json');
const SOURCE_MD = path.join(
  __dirname,
  '../../docs/data/outdoor-cruising-pins-override-2026-09-12.md',
);

const RED =
  /\bcottage\b|\bcottaging\b|glory\s*hole|truck\s*stop|cruising\s*area|nude\s*beach|public\s*toilet|\btoilets?\b|\bpse\b|\bsquirt\b/i;

type Spot = {
  name: string;
  city: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  external_id: string;
  nation: string;
  geocode_note?: string;
};

function parseNames(md: string): string[] {
  const lines = md.split(/\r?\n/);
  const names: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (line.startsWith('## Names')) {
      inList = true;
      continue;
    }
    if (!inList) continue;
    if (line.startsWith('#')) break;
    const t = line.trim();
    if (!t || t.startsWith('|') || t.startsWith('-') || t.startsWith('*')) continue;
    names.push(t);
  }
  return names;
}

function classify(name: string): { category: string; description: string } {
  const n = name.toLowerCase();
  if (/\bcar\s*park|\bcarpark|\blay-?by|\blayby|\bparking\b/.test(n)) {
    return { category: 'parking', description: 'Car park' };
  }
  if (
    /\bwood|\bforest|\bcopse|\bthicket|\bfirs|\bcovert|\bridget|\bdyke woods|\btrail woodland/.test(
      n,
    )
  ) {
    return { category: 'parks-trails', description: 'Woodland' };
  }
  return { category: 'open-spaces', description: 'Public park' };
}

function slugId(name: string): string {
  return `${EXTERNAL_PREFIX}:${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Query variants — strip noise that kills Nominatim hits. */
function queryVariants(name: string): string[] {
  const variants = new Set<string>();
  const base = name.trim();
  variants.add(base);
  variants.add(base.replace(/\s*&\s*/g, ' and '));
  variants.add(base.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim());
  variants.add(base.replace(/^A\d+\s*[/\-]?\s*/i, '').trim());
  variants.add(base.replace(/\bNB\b|\bWestbound\b|\bLay-by\b|\bLayby\b/gi, '').replace(/\s+/g, ' ').trim());
  // Known aliases / typo fixes for this South list
  const aliases: Record<string, string[]> = {
    'verely hill car park burley': ['Verely Hill car park', 'Burley Verely Hill'],
    'alton lay-by': ['Alton lay-by Hampshire', 'lay-by Alton Hampshire'],
    'a303 westbound - harewood forest': ['Harewood Forest', 'Harewood Forest Andover'],
    'church norton beach': ['Church Norton', 'Church Norton West Sussex'],
    'a31 lay-by nb (froyle park)': ['Froyle Park', 'lay-by Froyle'],
    'enham lane, charlton, andover': ['Enham Lane Charlton Andover', 'Enham Lane Andover'],
    'southbourne cliffs': ['Southbourne Cliffs Bournemouth', 'Southbourne cliff'],
    'tidworth woods': ['Tidworth woodland', 'Sidbury Hill Tidworth'],
    'west cliff - bowling green': ['West Cliff Bournemouth', 'West Cliff Gardens Bournemouth'],
    'a287/ farnham road lay-by (odiham)': ['Farnham Road Odiham', 'lay-by Odiham'],
    'martin down salisbury': ['Martin Down', 'Martin Down Nature Reserve'],
    'littlehampton seafront': ['Littlehampton seafront', 'Littlehampton Beach'],
    'white bridge oakdale': ['White Bridge Oakdale Poole', 'Oakdale Poole'],
    'bourley road car park': ['Bourley Road car park', 'Bourley Road Fleet'],
    'upton country park, blandford rd entrance': ['Upton Country Park', 'Upton Country Park Poole'],
    'frenches view point': ["French's View Point", 'Frenches Viewpoint'],
    "grant's firs a342": ["Grant's Firs", 'Grants Firs'],
    'thatcham canal lock': ['Thatcham canal', 'Monkey Marsh Lock Thatcham'],
    'wokefield common nature reserve': ['Wokefield Common', 'Wokefield Common Nature Reserve'],
    'pirbright woods layby': ['Pirbright Common', 'Pirbright woods'],
    'worthing yacht club': ['Worthing Yacht Club', 'Worthing harbour'],
    'charlton marshall station and woodland': ['Charlton Marshall', 'Charlton Marshall station'],
    'coombe rise car park': ['Coombe Rise car park', 'Coombe Rise Eastbourne'],
    'cathedral hill bushes': ['Cathedral Hill Winchester', 'Winchester Cathedral Close'],
    'wellingtonia avenue car park': ['Wellingtonia Avenue', 'Wellingtonia Avenue Crowthorne'],
    'fobney pump station & path': ['Fobney', 'Fobney Lock Reading'],
    'water tower car park': ['Water Tower car park Hampshire', 'Farley Mount water tower'],
    'cowsey wood nature reserve': ['Cowsey Wood', 'Cowsey Nature Reserve'],
    'lower earley/winnersh towpath': ['Lower Earley towpath', 'Winnersh towpath'],
    'dinton pastures country park (winnersh triangle)': ['Dinton Pastures Country Park'],
    'high wood woodley': ['High Wood Woodley', 'Highwood Woodley'],
    'woods behind earley station': ['Earley Station', 'Earley woodland'],
    'bulmershe park/meadow': ['Bulmershe Park', 'Bulmershe Meadow'],
    'whistley mill lane lay-by': ['Whistley Mill Lane', 'Whistley Green'],
    'fox covert (woodcote)': ['Fox Covert Woodcote', 'Fox Covert'],
    "devil's dyke car parks": ["Devil's Dyke", "Devil's Dyke Brighton"],
    'devils dyke woods': ["Devil's Dyke woods", "Devil's Dyke"],
    'greanleas park': ['Greenleas Park', 'Greenleas'],
    'the downs (cholsey)': ['Cholsey Downs', 'The Downs Cholsey'],
    'the ridgeway car park': ['Ridgeway car park', 'The Ridgeway National Trail car park'],
    'barbury castle trees': ['Barbury Castle', 'Barbury Castle Country Park'],
    'clanger woods - westbury': ['Clanger Wood', 'Clanger Wood Westbury'],
    'reading road a329 lay-by (cholsey)': ['Reading Road Cholsey', 'A329 Cholsey'],
    'box hill trail woodlands': ['Box Hill', 'Box Hill Surrey'],
    'charles ave pathway': ['Charles Avenue pathway', 'Charles Avenue'],
    'chittoe park': ['Chittoe', 'Chittoe Wiltshire'],
    'ipsden ridgeway': ['Ipsden', 'Ipsden Ridgeway'],
    'queens road car park': ['Queens Road car park Hampshire', 'Queens Road Fareham car park'],
  };
  const key = name.toLowerCase();
  for (const a of aliases[key] || []) variants.add(a);
  return [...variants].filter((v) => v.length >= 3);
}

async function nominatimGeocode(
  name: string,
): Promise<{ lat: number; lng: number; city: string; note: string } | null> {
  for (const qRaw of queryVariants(name)) {
    const q = encodeURIComponent(`${qRaw}, United Kingdom`);
    const url =
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=5&countrycodes=gb`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'MenRushOutdoorOverrideGeocode/1.0 (ops; residual-risk override artifact)',
          Accept: 'application/json',
        },
      });
    } catch {
      await sleep(1200);
      continue;
    }
    if (res.status === 429) {
      await sleep(5000);
      continue;
    }
    if (!res.ok) {
      await sleep(1100);
      continue;
    }
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        suburb?: string;
        county?: string;
      };
    }>;
    await sleep(1100);
    const ranked = data
      .map((row) => {
        const lat = Number(row.lat);
        const lng = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const dist = haversineKm(FAREHAM, { lat, lng });
        return { row, lat, lng, dist };
      })
      // ~180km covers Dorset→West Sussex→Berkshire→Wiltshire spill from Fareham
      .filter((x): x is NonNullable<typeof x> => !!x && x.dist <= 180)
      .sort((a, b) => a.dist - b.dist);
    const best = ranked[0];
    if (!best) continue;
    const addr = best.row.address || {};
    const city =
      addr.city || addr.town || addr.village || addr.suburb || addr.county || 'England';
    return {
      lat: best.lat,
      lng: best.lng,
      city,
      note: `Nominatim (${qRaw}): ${best.row.display_name} (~${best.dist.toFixed(0)}km Fareham)`,
    };
  }
  return null;
}

async function main() {
  const md = fs.readFileSync(SOURCE_MD, 'utf8');
  const names = parseNames(md);
  if (names.length < 100 || names.length > 130) {
    throw new Error(`Expected ~121 names, got ${names.length}`);
  }

  const batch1 = JSON.parse(fs.readFileSync(BATCH1, 'utf8')) as {
    spots: Array<{
      name: string;
      city: string;
      category: string;
      description: string;
      lat: number;
      lng: number;
      geocode_note?: string;
    }>;
  };
  const byBatch1 = new Map(batch1.spots.map((s) => [s.name.toLowerCase(), s]));

  const spots: Spot[] = [];
  const skipped: string[] = [];

  for (const name of names) {
    if (RED.test(name)) {
      skipped.push(`${name}: RED wording`);
      continue;
    }
    const { category, description } = classify(name);
    const prior = byBatch1.get(name.toLowerCase());
    if (prior && Number.isFinite(prior.lat) && Number.isFinite(prior.lng)) {
      spots.push({
        name,
        city: prior.city,
        category: prior.category || category,
        description: prior.description || description,
        lat: prior.lat,
        lng: prior.lng,
        external_id: slugId(name),
        nation: 'England',
        geocode_note: prior.geocode_note || 'Reused Batch 1 geocode',
      });
      continue;
    }

    const hit = await nominatimGeocode(name);
    if (!hit) {
      skipped.push(`${name}: geocode failed`);
      continue;
    }
    spots.push({
      name,
      city: hit.city,
      category,
      description,
      lat: hit.lat,
      lng: hit.lng,
      external_id: slugId(name),
      nation: 'England',
      geocode_note: hit.note,
    });
  }

  const payload = {
    _meta: {
      batch: 'ops-curated-override-2026-09-12',
      external_id_prefix: EXTERNAL_PREFIX,
      legal:
        'Al residual-risk OVERRIDE 2026-09-12. Legal colour stays RED (not a sign-off). South-first ~121 only — do NOT invent missing ~1100. Studio/Acquire/FAQ holds. Scene Toilets/Car/Cruising stay hidden. Soft-inactive Batch1 stays inactive unless listed here.',
      copy: 'Descriptions must be exactly Public park / Woodland / Car park. No toilet/cottage/PSE/cruising how-to.',
      geocode:
        'Nominatim OpenStreetMap (UK). Mapbox skipped (token not geocode-authorized in this env). Never invent lat/lng. Failures listed in skipped.',
      source: 'ops-curated',
      names_in_source: names.length,
      geocoded: spots.length,
      skipped,
    },
    spots,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `[geocode-override] names=${names.length} geocoded=${spots.length} skipped=${skipped.length} → ${OUT}`,
  );
  if (skipped.length) {
    console.log('[geocode-override] skip list:');
    for (const s of skipped) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
