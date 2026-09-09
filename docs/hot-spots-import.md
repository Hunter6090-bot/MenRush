# Hot Spots import (commercial venues only)

Ops / first-party curated commercial venue import. **Do not scrape competitor listings
from CI or commit credentials.** Prefer venue-supplied or hand-verified coordinates.

For the product lock, Brand face, and growth pointer checklist see
[`commercial-venue-hot-spots.md`](./commercial-venue-hot-spots.md).

## Allowed categories

`saunas`, `nightlife`, `bars`, `cinema` only.

Outdoor, parks, parking, transit, rest-facilities, PSE, cottaging, and similar RED rows
are rejected by the importer.

## Preferred path

```bash
cd backend
npm run hotspots:seed-commercial -- --file ./data/your-verified-venues.json --dry-run
npm run hotspots:seed-commercial -- --file ./data/your-verified-venues.json
```

Sample template (coords intentionally null — fill after hand verification):

`backend/data/commercial-venues.sample.json`

## Legacy import

```bash
npm run hotspots:import -- --file ../tmp/venues.json --source ops-commercial --dry-run
```

Still reads a local JSON/CSV only. Commercial allow-list enforced. Freshness window applies
unless `source` contains `ops` or `commercial`.

## JSON shape

```json
{
  "venues": [
    {
      "name": "Sweatbox Soho",
      "city": "London",
      "nation": "England",
      "category": "saunas",
      "venue_type": "sauna",
      "lat": 51.5132,
      "lng": -0.1391,
      "source_url": "https://example.com",
      "external_id": "ops-sweatbox-soho",
      "verified_at": "2026-09-09T12:00:00Z"
    }
  ]
}
```

Never invent lat/lng. Never seed hours, prices, or fake check-in counts.
