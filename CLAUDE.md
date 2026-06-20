# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**MenRush** is a real-time, location-first social and hookup platform designed for men who want to meet other men nearby — without delay, swiping, or friction.

At its core, MenRush is built around **live proximity awareness**. Users share their GPS location to instantly discover who is around them within a configurable radius (default 5km), enabling fast, direct, and intentional connections.

The product focuses on **speed, presence, and realism** — prioritising who is actually nearby and available right now.

### Core Positioning
> **"See who's near you right now."**

Supporting tone:
> No waiting. No swiping. Just men nearby.

### Branding
Dark, masculine copper/bronze aesthetic (`#C4832A` gold, `#0D0A06` background, `#F0E0C0` text). Designed to feel strong, direct, unfiltered, and premium.

---

## Core Concept

Unlike traditional dating apps that rely on swiping and delayed interactions, MenRush removes barriers and surfaces:
- Who is physically near you
- Who is currently active
- Who is open to connecting now

---

## Current Status

MenRush is in **pre-launch**. Landing page is live at **menrush.com** (Vercel), featuring:
- Countdown to October 1, 2026 launch
- Email waitlist (Formspree)
- Rotating slideshow of imagery

The full app is not yet deployed. `App.tsx` currently renders only `<ComingSoon />`.

---

## Core MVP Features

- Fast registration and authentication
- Profile creation with photo upload
- Interest and preference (including kink) selection
- Location-based discovery with filters (age, interests, radius)
- Like system with mutual match detection
- Real-time one-to-one messaging
- Group chat rooms
- Video calling
- Live online/offline status indicators
- Basic privacy controls

---

## Premium Subscription (Stripe — Upcoming)

### Discovery & Visibility
- See who liked you
- See profile views
- Profile boost (priority visibility)
- Unlimited likes (free capped at 20/day)
- Expanded radius (beyond 5km — free capped at 5km)

### Messaging & Interaction
- Message without matching
- Read receipts
- Voice messages
- Photo and video sharing

### Profile Enhancements
- Extended photo gallery (unlimited vs 6 free)
- Video profile intro
- Incognito browsing mode

### Advanced Access
- Advanced filters (body type, relationship type, kinks)
- Access to premium-only rooms and experiences

**ID verification with verified badge is available to ALL users, free or paid.**

---

## Technical Architecture

MenRush is a full-stack monorepo:

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js (Express) + Socket.IO
- **Database**: PostgreSQL with PostGIS
- **Auth**: Custom JWT using HMAC-SHA256
- **Deployment**: Docker, Railway (backend), Vercel (frontend)

---

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

---

## Backend Architecture (`backend/src/`)

Express + Socket.IO app compiled with `tsc`, entry point `server.ts`.

**Layer structure:**
- `routes/` — thin Express routers, parse/validate with Zod, delegate to services
- `services/` — business logic with direct SQL via `db.ts` pool
- `middleware/auth.ts` — extracts Bearer token, sets `req.userId`; also exports `errorHandler`
- `types/validation.ts` — all Zod schemas and inferred TypeScript types

**Custom JWT** — `auth.service.ts` uses HMAC-SHA256 via Node `crypto`. Token format: `base64url(payload).base64url(signature)`. `verifyToken` returns `{ userId }`.

**Socket.IO** — `userSockets: Map<string, string>` (userId → socketId) in memory. Events: `authenticate`, `message`, `typing`, `disconnect`, `room:*`, `call:*`.

**Geospatial** — PostGIS `GEOGRAPHY(POINT, 4326)` on `profiles.location`. `ST_MakePoint(lng, lat)` — longitude first. `ST_DWithin` for radius, `ST_Distance` for computed distance. Default radius: 5km.

**DB pattern** — no ORM. Raw SQL via `pg.Pool`. UUIDs via `uuidv4()` in application code.

---

## Frontend Architecture (`frontend/src/`)

- `api/client.ts` — axios instance at `VITE_API_URL || http://localhost:3000/api`. Token from `localStorage`.
- `hooks/store.ts` — Zustand store for auth state
- `hooks/useSocket.ts` — Socket.IO connection, emits `authenticate` on connect
- `App.tsx` — currently `<ComingSoon />` only (pre-launch)

---

## Database (`database/schema.sql`)

Tables: `users`, `profiles`, `messages`, `likes`, `rooms`, `room_members`, `room_messages`, `push_subscriptions`, `interests`.

`profiles` is 1:1 with `users`, created lazily on first `POST /users/location`. Location in both `GEOGRAPHY(POINT)` and raw `lat`/`lng` columns.

---

## Key Env Vars

| Var | Default | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `postgresql://menrush:menrush123@postgres:5432/menrush` | Backend |
| `JWT_SECRET` | `your-secret-key` | Change in production |
| `FRONTEND_URL` | `http://localhost:5173` | Socket.IO CORS |
| `VITE_API_URL` | `http://localhost:3000/api` | Frontend axios + socket |

---

## Security Warning

MCP Docker previously injected malicious code into this repo:
1. `frontend/src/api/client.ts` — exfiltration interceptor to `http://127.0.0.1:7779/ingest/...`
2. `backend/src/server.ts` — middleware doing the same

**Before any `git push`, audit these two files for unexplained outbound HTTP calls.**
