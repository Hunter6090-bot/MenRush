# MenRush Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL with PostGIS extension (see providers below)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (PostGIS-capable provider required) |
| `JWT_SECRET` | Generate with: `openssl rand -hex 32` |
| `FRONTEND_URL` | Your frontend domain (used for CORS and Socket.IO) |
| `VITE_API_URL` | Backend API URL for frontend build (e.g. `https://api.example.com/api`) |
| `VITE_SOCKET_URL` | Backend URL for Socket.IO (e.g. `https://api.example.com`) |

See `.env.example` for the full reference.

---

## Option A — Docker Compose (self-hosted)

```bash
cp .env.example .env
# Edit .env with real values (JWT_SECRET, FRONTEND_URL, etc.)
docker-compose up -d
```

PostgreSQL with PostGIS is included via `postgis/postgis:16-3.4`. Schema is auto-applied on first run.

---

## Option B — Railway

1. Push repo to GitHub.
2. Create a new Railway project → "Deploy from GitHub repo".
3. Add a PostgreSQL plugin — use the `postgis/postgis` image for PostGIS support.
4. Set env vars: `DATABASE_URL` (from plugin), `JWT_SECRET`, `FRONTEND_URL`.
5. Deploy — `railway.json` at the repo root handles build and start.
6. For the frontend: deploy separately to **Vercel** or **Netlify**, pointing to the `frontend/` directory. Set `VITE_API_URL` and `VITE_SOCKET_URL` to your Railway backend URL.

---

## Option C — Render

1. Push repo to GitHub.
2. New Render Blueprint → connect repo → `render.yaml` auto-configures both services and the database.
3. After services are created, fill in the sync-false env vars:
   - On `menrush-backend`: `FRONTEND_URL`
   - On `menrush-frontend`: `VITE_API_URL`, `VITE_SOCKET_URL`
4. **Important:** Render's free PostgreSQL does not include PostGIS. Use **Supabase** or **Neon** for the database and set `DATABASE_URL` manually instead of using `fromDatabase`.

---

## Database Setup

**Fresh database** (Docker Compose handles this automatically):
```bash
psql $DATABASE_URL -f database/schema.sql
```

**Existing database migration:**
```bash
psql $DATABASE_URL -f database/migrate.sql
```

---

## PostGIS Requirement

The app uses PostGIS for geospatial queries (`ST_DWithin`, `ST_Distance`). Providers that support PostGIS:

- **Supabase** — free tier, PostGIS enabled by default
- **Neon** — enable with `CREATE EXTENSION postgis;`
- **Railway PostgreSQL plugin** — use `postgis/postgis` Docker image
- **Self-hosted** — included in `docker-compose.yml`
