# Veriff identity verification

Optional **Verified** path: government ID scan + live selfie via Veriff. Brand badge word is Verified.

## Flow

1. After signup (when `VITE_FEATURE_VERIFF !== 'false'`), user lands on `/verify/id`
2. App calls `POST /api/verify/veriff/session` with the user JWT
3. Backend creates a Veriff session with `VERIFF_API_KEY`, stores the session id, sets `verification_status=pending`, returns `{ sessionId, sessionUrl }`
4. **Web** opens `@veriff/incontext-sdk` (`createVeriffFrame`) with that `sessionUrl` — ID + selfie stay on MenRush
5. Veriff posts a **decision webhook** to `POST /api/verify/veriff/webhook` (**primary** portal URL)
6. Webhook verifies `X-AUTH-CLIENT` + `X-HMAC-SIGNATURE` (HMAC-SHA256 of raw body with `VERIFF_SHARED_SECRET`)
7. **`is_verified` / Verified badge only when `verification.status === 'approved'`**

**Alias (belt-and-suspenders):** `POST /api/verify/webhook` uses the **same** raw-body HMAC handler → `applyDecision`. Mounted before JWT auth on `/api/verify`, so a misconfigured Station URL cannot 401 with `No token provided`. Prefer the primary path in the Veriff portal.

Native capture remains at `/verify/id/manual`.

## Missed-webhook recovery (re-poll)

If Veriff approved a session but the webhook never landed, `veriff_sessions` can stay `status=created` and the user stays `verification_status=pending` / `is_verified=false`.

**Backup path:** cron (or ops) calls an authenticated re-poll endpoint that:

1. Finds `veriff_sessions` with `status='created'` older than **N hours** (default **6**), joined to users who are still unverified / pending Veriff
2. For each session, HMAC-signed `GET {VERIFF_API_BASE}/sessions/{id}/decision` with:
   - `X-AUTH-CLIENT` = `VERIFF_API_KEY`
   - `X-HMAC-SIGNATURE` = HMAC-SHA256(**session id**, `VERIFF_SHARED_SECRET`)
3. If `verification.status` is a **final** decision (`approved` / `declined` / `resubmission_requested` / `expired` / `abandoned` / `review`), calls the same `applyDecision` used by the webhook
4. Never grants Verified without Veriff `approved`. Idempotent. Caps per run + small delay between GETs

### Endpoint

```http
POST /api/verify/veriff/repoll
GET  /api/verify/veriff/repoll
```

Auth header (required):

```http
X-Veriff-Repoll-Token: <VERIFF_REPOLL_TOKEN>
```

If `VERIFF_REPOLL_TOKEN` is unset, the endpoint returns `503 veriff_repoll_disabled`.

Query params (optional):

| Param | Purpose |
| --- | --- |
| `sessionId` | Single-session recovery (also skips min-age) |
| `userId` | Single-user recovery (also skips min-age) |
| `limit` | Cap sessions per run (default `VERIFF_REPOLL_MAX_PER_RUN`, max 100) |
| `minAgeHours` | Override N for this run |

Example cron (every hour):

```bash
curl -fsS -X POST \
  -H "X-Veriff-Repoll-Token: $VERIFF_REPOLL_TOKEN" \
  "$BACKEND_URL/api/verify/veriff/repoll"
```

Single-user recovery:

```bash
curl -fsS -X POST \
  -H "X-Veriff-Repoll-Token: $VERIFF_REPOLL_TOKEN" \
  "$BACKEND_URL/api/verify/veriff/repoll?userId=<uuid>"
```

Logs are prefixed `[veriff] re-poll ...`.

## Env

| Var | Where | Notes |
| --- | --- | --- |
| `VERIFF_API_KEY` | Backend | `X-AUTH-CLIENT` |
| `VERIFF_SHARED_SECRET` | Backend | HMAC secret (webhook body + GET session id) |
| `VERIFF_API_BASE` | Backend | Optional, default `https://stationapi.veriff.com/v1` |
| `VERIFF_REPOLL_TOKEN` | Backend | Required to call `/repoll`; leave unset to disable |
| `VERIFF_REPOLL_MIN_AGE_HOURS` | Backend | Default `6` — only re-poll sessions older than N hours |
| `VERIFF_REPOLL_MAX_PER_RUN` | Backend | Default `25` (hard cap 100) |
| `VERIFF_REPOLL_DELAY_MS` | Backend | Default `250` — pause between Veriff GETs |
| `VITE_FEATURE_VERIFF` | Frontend | Default on |

Portal: set Webhook decisions URL to `https://<API_HOST>/api/verify/veriff/webhook` (primary).
Both `/api/verify/veriff/webhook` and `/api/verify/webhook` accept signed decision POSTs.

## Notes

- Webhook is primary (`/api/verify/veriff/webhook`); `/api/verify/webhook` is an alias for misconfigured Station URLs; re-poll is backup for missed delivery (e.g. BOA90-style stuck `created`)
- One optional Veriff path only — Verified badge when approved. No Authentic-person live challenge; no Adult Trust Centre badge; no “Identity checked” product label.
- Client SDK completion never grants the badge — webhook or re-poll `applyDecision` only
- Parked PR #97 (adult-assurance / signup gate) stays parked; FEATURES.requireIdVerification stays false
- Unverified is the default; signup stays open without ID or selfie
