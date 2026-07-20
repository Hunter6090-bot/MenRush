# AGENTS.md

MenRush is a full-stack monorepo: React 18 + Vite frontend (`frontend/`, port 5173), Express 4 + Socket.IO backend (`backend/`, port 3000), and PostgreSQL 16 + PostGIS. See `CLAUDE.md` and `.cursor/rules/menrush-workflow.mdc` for architecture and coding standards.

## Cursor Cloud specific instructions

### Services and how to run them
- **PostgreSQL 16 + PostGIS** is installed natively (not Docker — Docker is unavailable in this VM). The DB data directory persists in the VM snapshot, so the `menrush` database, schema, and any seeded rows survive across sessions. The server process does NOT auto-start on boot — start it each session with `sudo pg_ctlcluster 16 main start`. Connection: `postgresql://menrush:menrush123@localhost:5432/menrush` (role `menrush` is a superuser).
- **Backend**: `cd backend && npm run dev` (ts-node, port 3000). Reads `backend/.env` via dotenv (from cwd). Health: `curl localhost:3000/health`.
- **Frontend**: `cd frontend && npm run dev` (Vite, port 5173). Vite proxies `/api`, `/uploads`, and `/socket.io` to `localhost:3000`, so no CORS/env wiring is needed locally.
- `.env` files (`backend/.env`, `frontend/.env`) are gitignored and already created in this environment. `JWT_SECRET` is a hard startup requirement — the backend refuses to boot without it. `DEV_AUTO_VERIFY=true` is set so new signups are auto-verified (Socket.IO and gated features require a verified user).

### Database schema gotcha (important)
- `database/schema.sql` (used by the Docker init) plus `npm run db:migrate` (which only applies `backend/database/migrations/`, files 021–024) is **incomplete** — it misses columns the running code needs, e.g. `users.is_pulsing`, causing errors like `column "is_pulsing" does not exist`.
- The **complete, canonical schema** comes from applying ALL of the root `database/migrations/*.sql` files (000–024) in order. They are idempotent (`IF NOT EXISTS` / `duplicate_column` guards).
- To (re)build the dev DB from scratch:
  ```bash
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS menrush;" -c "CREATE DATABASE menrush OWNER menrush;"
  for f in database/migrations/*.sql; do PGPASSWORD=menrush123 psql -h localhost -U menrush -d menrush -v ON_ERROR_STOP=1 -f "$f"; done
  ```

### Testing / discovery gotchas
- **No GPS in this VM**: browser geolocation will not return a fix. To test proximity discovery, set a user's location via `POST /api/users/location` (body `{"lat":...,"lng":...}`) with their `Authorization: Bearer <token>`. The profile-setup wizard also offers "Open Discover without location" to reach the app without GPS.
- **Discovery hides `@example.com` emails** unless `INCLUDE_E2E_FIXTURES=true`. Use non-example emails (e.g. `@menrushdemo.io`) for seed/test users you want to appear in Nearby.
- **Nearby filters**: a user only appears if they have a non-empty `photo_url` (a generic avatar is auto-assigned on registration), `is_visible = true`, not ghosted, and within radius.

### Optional integrations (env-gated; all degrade gracefully when unset)
These activate only when their env vars are present. Credentials are provided via the Cursor Secrets panel (injected as env vars, which `dotenv` does not override, so injected values win over `.env`). Non-secret config lives in `backend/.env`.
- **Mapbox** (discovery map): `VITE_MAPBOX_TOKEN` (frontend, read via `import.meta.env`; a `__SET_ME__` value counts as missing). Without it the Nearby **list** still works; only the map is blank.
- **Email**: **Resend** handles everything — password reset, waitlist, and the contact form (`RESEND_API_KEY` secret + `RESEND_FROM_EMAIL`/`RESEND_REPLY_TO` config). Zoho SMTP (`ZOHO_SMTP_*`) is now only an optional fallback if ever configured; it is not required. `RESEND_FROM_EMAIL` must be on a **Resend-verified domain** — `menrush.com` is verified; the `send.menrush.com` subdomain is not, so send from `hello@menrush.com`. The contact form delivers to `CONTACT_TO_EMAIL` (a real inbox, e.g. `hello@menrush.com`) with reply-to set to the submitter.
- **ID-verification AI pre-checks**: `HF_TOKEN` (or `HUGGINGFACE_API_KEY`); models default to CLIP/TrOCR. Note: those default models (`openai/clip-vit-base-patch32`, `microsoft/trocr-base-printed`) are **no longer served by HF Inference Providers**, so the AI pre-check throws and is caught → checks are marked "skipped" and basic checks still pass. For real AI validation, set `HF_ID_PRECHECK_CLIP_MODEL`/`HF_ID_PRECHECK_OCR_MODEL` to provider-served models. Without any token, AI validation is skipped entirely.
- **CCBill** (`CCBILL_*`): premium billing — intentionally left unconfigured.

### Lint / test / build
- **Lint**: none configured (no ESLint in this repo).
- **Build**: backend `npm run build` (tsc → `dist/`); frontend `npm run build` (brand-guard + tsc + vite build).
- **E2E**: Playwright in `frontend/` — `npm run test:e2e` (self-hosts a Vite server on port 4173). Browsers are installed via `npx playwright install --with-deps chromium`. The design-lock suite is `npm run test:e2e -- public-design-lock`.
