# Staging setup

## Goal

Staging must have its **own** Postgres with migrations applied — never share production data by accident, and never ship an empty schema (`relation "users" does not exist`).

## Railway

1. Environment: **staging**
2. Services: `backend` + `postgres` (PostGIS image)
3. Backend env (minimum):

| Var | Notes |
|-----|--------|
| `DATABASE_URL` | Prefer **public** proxy URL from the staging postgres service until internal DNS is reliable for ops scripts |
| `JWT_SECRET` | Distinct from production |
| `FRONTEND_URL` | Comma-list of allowed origins (localhost + staging frontends) |
| `ADMIN_TOKEN` | Ops admin routes |
| `TURN_URL` / `TURN_SECRET` | Same as prod for call testing |
| `UPLOADS_ROOT` | Optional; default `/app/uploads` when volume mounted |

4. Mount a volume on backend at `/app/uploads` for profile photos.

## Apply migrations

From repo root (uses public `DATABASE_URL` if set, else `railway variable`):

```bash
# Option A — public URL already exported
export DATABASE_URL='postgresql://…@shuttle.proxy.rlwy.net:PORT/menrush'
cd backend && npm run db:migrate

# Option B — pull from Railway staging postgres public URL
cd backend
export DATABASE_URL="$(railway variable list -e staging -s postgres --json | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).DATABASE_PUBLIC_URL))")"
npm run db:migrate
```

Migration script: `backend/src/scripts/migrate.ts`  
SQL files: `database/migrations/*.sql` (sorted).

## Smoke after migrate

```bash
curl -s https://backend-staging-f3aa.up.railway.app/api/health
curl -s -X POST https://backend-staging-f3aa.up.railway.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"…","password":"…"}'
```

Health JSON includes `media.ok` when the uploads volume is writable.

## Local frontend → staging

```env
# frontend/.env.local
VITE_API_URL=https://backend-staging-f3aa.up.railway.app/api
VITE_SOCKET_URL=https://backend-staging-f3aa.up.railway.app
```

**Must include `/api`** — client calls `${VITE_API_URL}/auth/login`.
