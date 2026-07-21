# Hot Spots import (Squirt-style / community exports)

Manual import path for cruising / venue dumps. **Do not scrape behind a login from CI
or commit credentials.** Prefer a local export file you already have.

## Freshness rule

Only spots with a check-in **or** comment (any of `lastActivity`, `lastCheckin`,
`lastComment`) within the last **30 days** are imported. Older rows are skipped.

## Env vars (optional — never commit values)

| Var | Purpose |
| --- | --- |
| `SQUIRT_EMAIL` | Account email if you run a private scrape tooling outside this repo |
| `SQUIRT_PASSWORD` | Account password (local shell / secret manager only) |
| `SQUIRT_SESSION` | Session cookie / token if using an authenticated export helper |
| `DATABASE_URL` | Postgres URL for the import script |

This repo’s import script **does not** call Squirt. It only reads a local JSON/CSV.

## Commands

From `backend/`:

```bash
# Dry-run (no DB writes)
npm run hotspots:import -- --file ../tmp/squirt-spots.json --dry-run

# Import
npm run hotspots:import -- --file ../tmp/squirt-spots.json --source squirt-import

# CSV
npm run hotspots:import -- --file ../tmp/spots.csv --source squirt-import
```

## JSON shape

```json
{
  "spots": [
    {
      "name": "Example Heath",
      "city": "London",
      "lat": 51.56,
      "lng": -0.17,
      "category": "open-spaces",
      "description": "Optional note",
      "externalId": "squirt-123",
      "lastActivity": "2026-07-10T12:00:00Z",
      "lastCheckin": "2026-07-09T18:00:00Z",
      "lastComment": "2026-07-08T09:00:00Z"
    }
  ]
}
```

CSV headers (flexible aliases): `name,city,lat,lng,category,description,externalId,lastActivity,lastCheckin,lastComment`.
