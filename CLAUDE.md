# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

NearNow is a location-based social discovery app. Users share their GPS location to find and message other users nearby. The core value prop is real-time proximity awareness + direct messaging.

## Commands

### Backend (run from `backend/`)
```bash
npm run dev        # ts-node src/server.ts (development, no build step)
npm run build      # tsc → dist/
npm start          # node dist/server.js (production)
npm run db:migrate # apply schema.sql to $DATABASE_URL
```

### Frontend (run from `frontend/`)
```bash
npm run dev        # vite dev server on :5173
npm run build      # tsc + vite build
```

### Infrastructure
```bash
docker-compose up          # starts postgres (PostGIS) + backend
docker-compose up postgres # start only the DB (then run backend locally)
```

No test runner is configured yet.

## Architecture

### Backend (`backend/src/`)
Express + Socket.IO app compiled with `tsc`, entry point `server.ts`.

**Layer structure:**
- `routes/` — thin Express routers, parse/validate with Zod, delegate to services
- `services/` — business logic with direct SQL via `db.ts` pool
- `middleware/auth.ts` — extracts Bearer token, sets `req.userId`; also exports `errorHandler`
- `types/validation.ts` — all Zod schemas and inferred TypeScript types

**Custom JWT implementation** — `auth.service.ts` does NOT use `jsonwebtoken`. It implements HMAC-SHA256 signing manually using Node's `crypto` module. Token format is `base64url(payload).base64url(signature)` (no header segment). `verifyToken` returns `{ userId }`.

**Socket.IO** — server maintains a `userSockets: Map<string, string>` (userId → socketId) in memory. On `authenticate` event, users join room `user:<userId>` and are marked online in the DB. On disconnect, they're marked offline. Socket events: `authenticate`, `message`, `typing`, `disconnect`.

**Geospatial** — PostGIS `GEOGRAPHY(POINT, 4326)` column on `profiles.location`. `ST_MakePoint(lng, lat)` — note argument order is **longitude first**. `ST_DWithin` for radius queries, `ST_Distance` for computed distance. Radius defaults to 5 km.

**DB pattern** — no ORM. All queries use `query(sql, params)` from `db.ts` (thin wrapper over `pg.Pool`). UUIDs generated with `uuidv4()` in application code before insert.

### Frontend (`frontend/src/`)
Vite + React 18 + TypeScript.

- `api/client.ts` — axios instance pointed at `VITE_API_URL || http://localhost:3000/api`. Interceptor reads token from `localStorage`.
- `hooks/store.ts` — Zustand store for auth state (token, user)
- `hooks/useSocket.ts` — creates Socket.IO connection authenticated with JWT, emits `authenticate` on connect
- Pages: `Login`, `Register`, `Discover` (nearby users map), `Messaging` (conversation view)
- `App.tsx` — React Router v6; `/discover` and `/messages/:otherId` are protected routes

### Database (`database/schema.sql`)
Three tables: `users`, `profiles`, `messages`. `profiles` has a 1:1 with `users` and is created lazily on first `POST /users/location`. Location stored in both `GEOGRAPHY(POINT)` (for spatial queries) and raw `lat`/`lng` decimal columns.

## Key Env Vars

| Var | Default | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `postgresql://nearnow:nearnow123@postgres:5432/nearnow` | Used by backend |
| `JWT_SECRET` | `your-secret-key` | Change in production |
| `FRONTEND_URL` | `http://localhost:5173` | Used for Socket.IO CORS |
| `VITE_API_URL` | `http://localhost:3000/api` | Used by frontend axios client and socket |

Copy `.env.example` to `backend/.env` for local development outside Docker.
