# Veriff identity verification

Optional **Identity checked** path: government ID scan + live selfie via Veriff.

## Flow

1. After signup (when `VITE_FEATURE_VERIFF !== 'false'`), user lands on `/verify/id`
2. App calls `POST /api/verify/veriff/session` with the user JWT
3. Backend creates a Veriff session with `VERIFF_API_KEY`, stores the session id, sets `verification_status=pending`, returns `{ sessionId, sessionUrl }`
4. **Web** opens `@veriff/incontext-sdk` (`createVeriffFrame`) with that `sessionUrl` — ID + selfie stay on MenRush
5. Veriff posts a **decision webhook** to `POST /api/verify/veriff/webhook`
6. Webhook verifies `X-AUTH-CLIENT` + `X-HMAC-SIGNATURE` (HMAC-SHA256 of raw body with `VERIFF_SHARED_SECRET`)
7. **`is_verified` / Identity checked badge only when `verification.status === 'approved'`**

Native capture remains at `/verify/id/manual`.

## Env

| Var | Where |
| --- | --- |
| `VERIFF_API_KEY` | Backend |
| `VERIFF_SHARED_SECRET` | Backend |
| `VERIFF_API_BASE` | Optional, default `https://stationapi.veriff.com/v1` |
| `VITE_FEATURE_VERIFF` | Frontend (default on) |

Portal: set Webhook decisions URL to `https://<API_HOST>/api/verify/veriff/webhook`.

## Notes

- Does not replace Adult confirmed or Authentic person tiers
- Client SDK completion never grants the badge — webhook only
- Parked PR #97 (adult-assurance enforcement) is untouched
