# Railway deploy walkthrough — MenRush backend

End-to-end recipe to get the MenRush backend running on Railway so the
`/contact`, `/api/waitlist`, and (eventually) full-app routes have a real
server to hit in production. The frontend already lives on Vercel; this only
deploys the backend.

**Estimated time:** 45 minutes the first time. ~5 minutes per redeploy after.

---

## 0 — What's already in the repo

| File | Purpose |
|---|---|
| `backend/Dockerfile` | `node:18-alpine`, builds via `npm run build`, exposes `:3000`, runs `npm start`. |
| `railway.json` | Tells Railway: build from `backend/Dockerfile`, health-check `/health`, retry 3× on crash. |
| `backend/.env.example` | Reference for every env var the backend reads. |
| `database/schema.sql` | Full schema. Requires **PostGIS**. |
| `database/migrations/*.sql` | Forward-only migrations applied in order. |

You don't need to change any of these to deploy.

---

## 1 — Decide where Postgres lives

Railway's native PostgreSQL plugin doesn't include PostGIS, and MenRush uses
`GEOGRAPHY(POINT, 4326)` + `ST_DWithin` / `ST_Distance` extensively. You have
three options:

| Option | Setup | Cost | Recommendation |
|---|---|---|---|
| **Supabase** | Sign up → New project → PostGIS is pre-enabled. | Free tier OK for pre-launch. | **Pick this** — least friction. |
| **Neon** | Sign up → create branch → `CREATE EXTENSION postgis;` | Free tier, generous. | Good fallback. |
| Railway + custom Postgres image | `postgis/postgis:16-3.4` deployed as a service. | Eats Railway hours. | Only if you must keep everything in one platform. |

The rest of this guide assumes **Supabase**.

### Provision the DB

1. https://supabase.com/dashboard → New project → name `menrush-prod`,
   region near your users (Frankfurt or London for UK).
2. After provisioning, Settings → Database → **Connection string** → **URI**.
   Grab the value starting with `postgresql://postgres.<ref>:...@...supabase.com:5432/postgres`.
3. SQL editor → run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
4. Apply the schema. Locally:
   ```bash
   psql "<connection-string>" -f database/schema.sql
   ```
   For follow-up incremental changes:
   ```bash
   for f in database/migrations/*.sql; do
     psql "<connection-string>" -f "$f"
   done
   ```

---

## 2 — Set up the Railway service

1. https://railway.app → New Project → **Deploy from GitHub repo** → pick
   `Hunter6090-bot/MenRush` → branch `main` (or whichever branch you're
   deploying).
2. Railway will detect `railway.json` and queue a build. It will fail on the
   first run because env vars aren't set yet — that's expected.

### Required env vars (Variables tab)

| Var | Value |
|---|---|
| `DATABASE_URL` | Supabase connection string from §1 |
| `JWT_SECRET` | `openssl rand -hex 32` output — long random string |
| `NODE_ENV` | `production` |
| `PORT` | leave unset — Railway injects its own |
| `FRONTEND_URL` | `https://menrush.com` (used for CORS + Socket.IO) |

### Email (Zoho — needed for contact form + drip)

| Var | Value |
|---|---|
| `ZOHO_SMTP_HOST` | `smtp.zoho.com` |
| `ZOHO_SMTP_PORT` | `587` |
| `ZOHO_SMTP_SECURE` | `false` |
| `ZOHO_SMTP_USER` | `hello@menrush.com` |
| `ZOHO_SMTP_PASS` | the Zoho app-specific password (same one in your local `backend/.env`) |
| `CONTACT_TO_EMAIL` | `privacy@menrush.com` |
| `CONTACT_FROM_EMAIL` | `hello@menrush.com` |
| `MAIL_FROM_EMAIL` | `hello@menrush.com` (drip sender) |

### Drip (only if you're using the self-hosted drip — see `docs/self-hosted-drip.md`)

| Var | Value |
|---|---|
| `PUBLIC_API_URL` | Once you have the Railway URL: `https://<service>.up.railway.app` (or your custom domain) |
| `DRIP_ADMIN_TOKEN` | `openssl rand -hex 32` — required to call admin endpoints |
| `DRIP_WORKER_ENABLED` | `true` (in-process worker) or `false` (external cron) |
| `DRIP_WORKER_INTERVAL_MINUTES` | `60` |

### Optional: Stripe Identity, Web Push, etc.

Skip these unless those features are wired into the deployed branch. See
`backend/.env.example` for the full list.

### Trigger a redeploy

After saving env vars, Deployments tab → click the failed deploy → **Redeploy**.
Build should complete in ~3 minutes (Docker image is ~150 MB).

---

## 3 — Smoke test the deployment

Railway gives you a URL like `https://menrush-backend-production.up.railway.app`.

```bash
URL=https://<your-railway-url>

# Health check (configured in railway.json).
curl -fsS "$URL/health"
# → {"status":"ok"}

# Waitlist signup (idempotent; safe to run repeatedly).
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"al+deploy@menrush.com","source":"smoke-test"}' \
  "$URL/api/waitlist"
# → {"success":true,"already_subscribed":false,"message":"..."}

# Drip stats (needs DRIP_ADMIN_TOKEN).
curl -H "X-Drip-Admin-Token: $DRIP_ADMIN_TOKEN" "$URL/api/waitlist/admin/stats"
# → {"subscribers":{"active":1,...},"due_now":1,...}

# Trigger a drip batch to send the welcome email.
curl -X POST -H "X-Drip-Admin-Token: $DRIP_ADMIN_TOKEN" \
  "$URL/api/waitlist/admin/run?limit=10"
# → {"attempted":1,"sent":1,"skipped":0,"errors":[]}
# Check al+deploy@menrush.com inbox for the welcome email.

# Contact form (once /contact is merged to main).
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Smoke","email":"smoke@example.com","enquiryType":"general","message":"Test from deployed backend."}' \
  "$URL/api/contact"
# → {"success":true,"message":"Thanks — we'll be in touch within 48 hours."}
# Check privacy@menrush.com inbox.
```

If any of these fail, check the **Deploy Logs** in Railway — they stream
`console.log` and any uncaught errors. Most common issues:

| Symptom | Cause | Fix |
|---|---|---|
| Build fails on `tsc` | Type errors not caught locally | Run `cd backend && npm run build` locally before pushing |
| `Server refuses to start` | `JWT_SECRET` is the default placeholder | Set a real value via `openssl rand -hex 32` |
| `/api/contact` returns 503 | `ZOHO_SMTP_PASS` not set | Re-paste the app password (no trailing newline) |
| `/api/users/...` returns 500 with `ST_DWithin` error | Postgres without PostGIS | `CREATE EXTENSION postgis;` on the Supabase DB |
| CORS error in browser console | `FRONTEND_URL` mismatched | Must be exact origin, no trailing slash |

---

## 4 — Custom domain (`api.menrush.com`)

Optional but recommended — keeps the URL clean and lets you swap hosting
providers later without a frontend redeploy.

1. Railway service → Settings → **Domains → Custom Domain** → `api.menrush.com`.
2. Railway gives a CNAME target like `<service>.up.railway.app`.
3. On your DNS provider (Vercel DNS, or wherever `menrush.com` is hosted):
   ```
   api.menrush.com  CNAME  <service>.up.railway.app
   ```
4. Wait for TLS to provision (~5 min). Once it's green:
   ```bash
   curl -fsS https://api.menrush.com/health
   # → {"status":"ok"}
   ```
5. Update `PUBLIC_API_URL` in Railway → `https://api.menrush.com`.

---

## 5 — Point Vercel at the new backend

1. https://vercel.com/dashboard → MenRush project → **Settings → Environment Variables**.
2. Add (Production scope):
   ```
   VITE_API_URL=https://api.menrush.com/api
   VITE_SOCKET_URL=https://api.menrush.com
   ```
   (Use the Railway URL if you skipped the custom domain step.)
3. Deployments → trigger a redeploy (envs only apply to new builds).
4. Hard-refresh https://menrush.com — open DevTools → Network — any
   `fetch('/contact')` or `fetch('/waitlist')` should now resolve to the
   `api.menrush.com` origin.

---

## 6 — Wiring up the drip (if self-hosted path)

Two parts: (a) get signups into the backend's `waitlist` table, (b) schedule
the worker.

### a) Signups
Today, `frontend/src/pages/ComingSoon.tsx` on `main` POSTs only to Zoho Forms.
For the self-hosted drip to fire, either:

- **Replace** the Zoho Forms POST with `fetch('https://api.menrush.com/api/waitlist', { method: 'POST', ... })`, or
- **Add** the backend POST alongside Zoho Forms (dual-write).

If `DRIP_WORKER_ENABLED=true` is set on Railway, the welcome email goes out
within the next worker tick (default: 1 hour).

### b) Scheduling
If you'd rather not use the in-process worker, set up an external cron. The
simplest option for a Railway deploy is a **GitHub Action**:

```yaml
# .github/workflows/drip-cron.yml
name: Drip cron
on:
  schedule:
    - cron: '*/30 * * * *'  # every 30 minutes
  workflow_dispatch:
permissions: { contents: read }
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - name: Run drip batch
        run: |
          curl -fsS -X POST \
            -H "X-Drip-Admin-Token: ${{ secrets.DRIP_ADMIN_TOKEN }}" \
            "https://api.menrush.com/api/waitlist/admin/run?limit=100"
```

Add `DRIP_ADMIN_TOKEN` as a repository secret. Disable the in-process worker
(`DRIP_WORKER_ENABLED=false`) when using this.

---

## 7 — Day-2 ops

### Tail logs
Railway dashboard → service → **Deploy Logs** (streaming) or **Build Logs**.

### Run a one-off migration
Railway doesn't ship a built-in psql shell. Easiest path is local:
```bash
psql "$DATABASE_URL" -f database/migrations/00X_new.sql
```
Or use Supabase's web SQL editor.

### Roll back a bad deploy
Railway → Deployments → previous successful deploy → **Redeploy**. Done.

### Health monitoring
`healthcheck.sh` at the repo root already pings `/health`, the waitlist
endpoint, and SMTP env presence. Drop it on any cron host:
```bash
crontab -e
# */15 * * * * /opt/menrush/healthcheck.sh >> /var/log/menrush-health.log 2>&1
```

---

## Final checklist before flipping the contact form live

- [ ] Railway backend deployed and `/health` returns 200
- [ ] `JWT_SECRET` rotated to a real value
- [ ] `ZOHO_SMTP_*` env vars set; smoke-tested via `/api/contact` curl
- [ ] DNS for `api.menrush.com` (or chosen subdomain) is live with TLS
- [ ] Vercel has `VITE_API_URL` pointing at the deployed backend
- [ ] Vercel triggered a redeploy after setting envs
- [ ] Cherry-pick PR for `/contact` (see `docs/contact-cherry-pick.md`)
      is opened **after** all of the above, and merged only once green
- [ ] Verified on https://menrush.com/contact that a submission produces
      an email in `privacy@menrush.com` within 30 seconds
