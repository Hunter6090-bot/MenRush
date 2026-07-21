# MenRush — Cursor Workflow Guide

A step-by-step guide for working on the **existing** MenRush monorepo with Cursor Agent mode. Adapted from an AI-generated scaffold draft; inaccuracies from that draft are corrected below.

---

## Actual MenRush stack (this repo)

**Read this first.** The original guide described a greenfield backend with Prisma, Redis, H3, and JWT refresh tokens. **None of that matches this codebase.**

| Topic | Generic guide claimed | **MenRush actually uses** |
| --- | --- | --- |
| Project state | Empty folder to scaffold | Full monorepo: `frontend/`, `backend/`, `database/` |
| Backend framework | Express (correct) | Express 4 + Socket.IO on one HTTP server |
| Database access | Prisma ORM | Raw **`pg` Pool** + SQL in services |
| Migrations | `prisma migrate dev` | SQL files in `database/migrations/`; `npm run db:migrate` |
| Cache / queues | Redis | **None** — in-memory Socket.IO user map |
| Location privacy | H3 resolution 8 only | PostGIS + **distance bucketing** + **obfuscated map points** (`privateMapPoint` in `user.service.ts`) |
| Auth | `jsonwebtoken` + refresh rotation | **Custom HMAC-SHA256 JWT** (`auth.service.ts`), 7-day token, `localStorage` — **no refresh tokens** |
| Package manager | pnpm preferred | **npm** (both `package-lock.json` files) |
| Docker Compose | Postgres + Redis | **Postgres (PostGIS) + backend + nginx** — no Redis service |
| ID verification | External webhook + Redis staging | Native verification pipeline in `backend/src/services/verification/` |
| Tests | Vitest (suggested) | **Playwright E2E** in `frontend/`; backend has ad-hoc scripts only |
| Rules file | Legacy `.cursorrules` | **`.cursor/rules/*.mdc`** (see `.cursor/rules/menrush-workflow.mdc`) |

Authoritative references: root `CLAUDE.md`, `docs/observability-privacy.md`, `.cursor/rules/menrush-workflow.mdc`.

### Design locks (do not regress)

- **Logo**: `.cursor/rules/menrush-logo.mdc`
- **Public landing/auth pages**: `.cursor/rules/public-marketing-pages.mdc` — enforced by `frontend/e2e/public-design-lock.spec.ts`

---

## Before you start

- **Cursor** installed (check **Cursor → About** for version)
- **Docker Desktop** (for local PostGIS via `docker-compose`)
- **Node.js 20+** and **npm**
- Repo root `/Users/alzain/em` open in Cursor (not an empty folder)

---

## Step 1: Lock in project rules

Cursor reads **`.cursor/rules/*.mdc`**, not the legacy `.cursorrules` file.

| File | Purpose |
| --- | --- |
| `.cursor/rules/menrush-workflow.mdc` | Real stack, architecture, privacy, dev commands |
| `.cursor/rules/menrush-logo.mdc` | Canonical medallion asset |
| `.cursor/rules/public-marketing-pages.mdc` | Landing/login/register design lock |
| `.cursorignore` | Keeps secrets and bulky dirs out of AI context |

Do **not** ask the Agent to scaffold Prisma, Redis, H3, or refresh-token auth unless product explicitly requests a migration project.

---

## Step 2: Set up environment variables first

Create `.env` at the repo root (and/or `backend/.env` as your setup requires) **before** asking the Agent to wire new code. Never commit `.env`.

### Core (local dev)

```bash
DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush
JWT_SECRET=your-secret-key-change-in-production
FRONTEND_URL=http://localhost:5173
PORT=3000
NODE_ENV=development
```

### Frontend (`frontend/.env` or Vite env)

```bash
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
# Optional: maps, Sentry, Statsig
VITE_MAPBOX_TOKEN=
VITE_SENTRY_DSN=
VITE_STATSIG_CLIENT_KEY=
```

### Common optional backend vars

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push |
| `SENTRY_DSN` | Error reporting (PII scrubbed) |
| `BETA_INVITE_REQUIRED` | Gate registration with invite codes |
| `DEV_AUTO_VERIFY` | Skip verification in dev only |
| `TURN_URL`, `TURN_SECRET` (or `TURN_USERNAME`+`TURN_CREDENTIAL`) | WebRTC TURN; omit to use Metered Open Relay static-auth default |
| `ADMIN_TOKEN` | Admin route smoke tests |

There is **no** `REDIS_URL`, `JWT_REFRESH_SECRET`, or `prisma/schema.prisma` in this repo.

---

## Step 3: Open Agent mode

Shortcut names change between Cursor versions. Verify in **Cursor → Settings → Keyboard Shortcuts**.

| Action | Typical shortcut (2025–2026 Cursor) |
| --- | --- |
| Open Chat | **Cmd+L** (macOS) / **Ctrl+L** (Windows/Linux) |
| Agent mode | Mode dropdown at top of Chat → **Agent** |
| Inline edit | **Cmd+K** on selected code |
| Submit prompt | **Enter** or **Cmd+Enter** (depends on setting) |

Older guides referenced **Cmd+I** or **Cmd+Shift+I** for Composer; that UI merged into Chat. **Cmd+K** still works for targeted single-file edits.

---

## Step 4: Example Agent prompts (existing repo)

Use prompts that reference **real paths and patterns**, not a from-scratch scaffold.

**Good — add a feature:**

> Add a `GET /api/users/me/settings` route following the existing pattern: Zod schema in `types/validation.ts`, thin route in `routes/users.ts`, SQL in `user.service.ts`. Reuse `auth` middleware.

**Good — fix discovery:**

> In `user.service.ts`, adjust distance bucketing for users under 500 m. Keep `privateMapPoint` obfuscation; do not return other users' stored lat/lng.

**Bad — do not use on this repo:**

> Scaffold Express + Prisma + Redis with H3 location indexing and refresh token rotation.

---

## Step 5: Review Agent output

Agent works **sequentially** across files (plan → generate one file at a time). Review diffs before accepting.

### Checklist for this codebase

- [ ] **SQL**: Uses `query()` from `db.ts`, not Prisma client
- [ ] **Validation**: Zod schema exists and route calls `.parse()` / `.safeParse()`
- [ ] **Auth**: Bearer token via existing middleware; no new refresh-token flow
- [ ] **Location**: Discovery uses bucketing + `privateMapPoint`; match live location respects opt-in
- [ ] **Socket.IO**: Events follow patterns in `server.ts`
- [ ] **Error handler**: Stays registered after routes
- [ ] **Rate limits**: Auth/public routes still limited where appropriate
- [ ] **Marketing pages**: If touching `/`, `/login`, `/register`, run `npm run test:e2e -- public-design-lock`
- [ ] **Security audit**: No new outbound calls in `api/client.ts` or `server.ts`
- [ ] **Logo / brand**: No CSS radar, CoinFlip, or non-canonical logo paths

### Run locally after accepting

```bash
docker-compose up postgres          # or full stack
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Apply schema changes with migrations in `database/migrations/`, then `cd backend && npm run db:migrate`.

---

## Step 6: Verification and sensitive data (actual pattern)

The generic guide described Onfido webhooks + Redis staging. MenRush uses a **native verification pipeline**:

- Routes: `backend/src/routes/verify.ts`
- Services: `backend/src/services/verification/` (face match, ID precheck, dedup, handoff)
- Uploads: `uploads/verification/` (gitignored)
- Files removed after processing where applicable (`removeSubmissionFiles`)

When changing verification code, preserve dedup hashing, access gating (`RequireVerified` on frontend), and avoid logging document contents or biometrics.

---

## Step 7: Ongoing Cursor tips

1. **Cmd+K** for surgical edits on auth, location, or verification — safer than full Agent runs.
2. **Rules apply automatically** via `.cursor/rules/` — no need to re-paste stack info each session.
3. **Reject `.env` diffs** — secrets stay out of the model context; keep `.cursorignore` updated.
4. **E2E for UI** — `cd frontend && npm run test:e2e` after meaningful frontend changes.
5. **Read `docs/observability-privacy.md`** before adding analytics events or Sentry breadcrumbs.

---

## Appendix: Key packages (actual)

### Backend (`backend/package.json`)

| Package | Purpose |
| --- | --- |
| `express`, `socket.io` | HTTP API + realtime |
| `pg` | PostgreSQL driver (raw SQL) |
| `zod` | Request validation |
| `bcryptjs` | Password hashing |
| `express-rate-limit`, `helmet`, `cors` | Security middleware |
| `sharp`, `multer` | Image upload/processing |
| `otplib` | TOTP 2FA |
| `web-push` | Push notifications |
| `@sentry/node` | Error reporting |

### Frontend (`frontend/package.json`)

| Package | Purpose |
| --- | --- |
| `react`, `react-router-dom`, `vite` | UI + routing + build |
| `axios` | REST client (`api/client.ts`) |
| `socket.io-client` | Realtime |
| `zustand` | Auth/UI state |
| `@tanstack/react-query` | Server state |
| `mapbox-gl`, `leaflet` | Maps |
| `@playwright/test` | E2E tests |

**Not in this repo:** `prisma`, `@prisma/client`, `h3-js`, `ioredis`, `jsonwebtoken`, `vitest`.

---

## Review notes (original draft corrections)

| Issue | Original draft | Corrected for MenRush |
| --- | --- | --- |
| Keyboard shortcuts | Cmd+I / Cmd+Shift+I for Composer | **Cmd+L** Chat + Agent dropdown; **Cmd+K** inline |
| ORM | Prisma over PostgreSQL | **Raw `pg`** — Prisma is not an alternative DB |
| `.cursorignore` | Omitted | **Required** at repo root |
| Env setup | Skipped | **Step 2** — real var names for this repo |
| Location privacy | H3 resolution 8 only | **PostGIS + bucketing + obfuscated points** |
| Auth | 15m access + refresh rotation | **7-day custom JWT**, no refresh |
| Docker | Postgres + Redis | **PostGIS only** (+ optional backend/nginx) |
| Parallel generation | "In parallel" | Agent is **sequential** |
| IDV | Webhook + Redis + cron | **Native verification services** |
| Rules location | `.cursorrules` | **`.cursor/rules/*.mdc`** |
| Scaffold prompt | Greenfield `src/` tree | **Extend existing** `backend/src/` layout |
