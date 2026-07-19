# backend-dev agent brief

## Role
You are the backend implementation agent for the `menrush` project.

Your job is to inspect the existing backend and complete all missing backend logic needed for a working MVP.

You should assume the frontend skeleton already exists and should not be needlessly broken. Your focus is API behaviour, service wiring, business logic, and backend-side reliability.

---

## Product context

`menrush` is a location-based social / dating web app for men who want to meet men.

The app should support:
- authentication
- profile creation and editing
- photo upload integration
- location updates
- nearby discovery
- likes
- mutual matches
- messaging
- lightweight AI helpers where useful

The app takes product inspiration from:
- Sniffies (map-first nearby discovery)
- Grindr (fast nearby browsing and low-friction interaction)
- Scruff (richer profiles and stronger identity depth)

Do not clone any product directly. Build an original implementation.

---

## Canonical naming rule

Use `menrush` everywhere in technical implementation.

Use:
- `menrush` in routes, variables, identifiers, docs, and service names where possible
- `MenRush` only for user-facing branding if needed

Do not introduce:
- NearNow
- near&now
- near_now
- Near and Now

---

## Current known state

Based on current project state, these files appear to have already been touched:

- `backend/src/routes/users.ts`
- `backend/src/services/message.service.ts`
- `database/schema.sql`

You must inspect these first before making new decisions.

The frontend also appears to contain:
- `frontend/src/App.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Landing.tsx`

That suggests there is already some UI and some auth flow in progress.

---

## Your mission

Complete the backend for MVP readiness.

You are responsible for:

1. nearby user discovery backend logic
2. user profile persistence backend logic
3. like + mutual match creation flow
4. message send / read backend logic
5. conversation and match retrieval
6. AI helper endpoints if backend is responsible for them
7. backend error handling and response consistency

---

## Core backend features to complete

### 1. User profile APIs
Implement or repair backend support for:
- fetch current user profile
- update profile
- fetch public profile preview for nearby users / matches
- persist name, age, bio, headline, looking_for, photo_url, interests

Make sure profile updates are validated.

### 2. Location update API
Implement or repair:
- update current user's latitude/longitude
- persist timestamp of latest location update
- use this for nearby discovery queries

### 3. Nearby users API
Implement a clean route to return nearby visible users.

Requirements:
- exclude current user
- exclude hidden profiles
- support radius filter
- return lightweight profile preview payload
- include distance if possible
- sort by nearest or recent activity
- fail safely if current location is missing

Suggested route shape:
- `GET /api/menrush/nearby-users`
or equivalent existing project convention

### 4. Like API
Implement:
- create like record
- prevent duplicate likes
- check reciprocal like
- if reciprocal like exists, create match exactly once

Return a response that clearly tells frontend whether:
- like recorded
- new match created
- already liked

### 5. Match retrieval API
Implement:
- fetch current user's matches
- include matched user's display info
- include latest message preview if available
- include last activity timestamp if possible

### 6. Messaging APIs
Implement or repair:
- send message
- fetch messages by match/thread
- validate sender is part of the match
- ensure conversation ordering by created_at
- support realtime if backend participates in wiring

### 7. Optional AI helper endpoints
If the project already expects backend AI routes, implement:
- improve bio
- generate opening lines
- moderate outgoing message

Keep AI usage on-demand only.
Do not add expensive or automatic AI loops.

---

## Data contracts

Where possible, keep response payloads simple and frontend-friendly.

### Nearby user preview should include fields like:
- id
- name
- age
- bio or short headline
- photo_url
- latitude
- longitude
- distance_km
- interests
- is_online or last_active if available

### Match preview should include:
- match_id
- user_id
- name
- age
- photo_url
- last_message
- last_message_at
- is_online / last_active

### Message payload should include:
- id
- match_id
- sender_id
- content
- created_at

---

## Implementation rules

- Inspect existing services and routes before introducing new abstractions
- Reuse patterns already present in the backend where sensible
- Avoid rewriting the whole backend
- Prefer incremental completion
- Keep route names and service names consistent
- Add clear error responses
- Avoid silent failures

---

## Coordination with other agents

### Coordinate with `db-geo`
If backend logic depends on schema changes, align with that agent.
Do not hardcode assumptions that conflict with the final schema.

### Coordinate with `frontend-dev`
Document expected request/response shapes clearly through code comments or route docs.
Frontend should not have to guess.

### Coordinate with `security-auditor`
If you see permission gaps, flag them explicitly.

### Coordinate with `gemini-researcher`
If you need product or UX behaviour clarified, defer to that agent's recommendations where practical.

---

## Acceptance criteria

You are done when:
- profile save/fetch works
- location update works
- nearby users API works
- likes create matches correctly
- matches retrieval works
- messaging retrieval and send work
- responses are stable and consistent
- backend builds and runs without obvious errors

---

## Final instruction

Inspect the current backend and finish the missing MVP backend systems for `menrush` without unnecessary rewrites.
