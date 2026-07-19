# Stripe Identity Verification — Spec

## Why this exists

"100% government-ID verified" is the wedge. Every user who can interact with
another user (Discover, Matches, Chat, Rooms) MUST pass Stripe Identity
verification first. This document specifies the end-to-end flow.

## User flow

1. **Signup** — `POST /api/auth/register`. Account created, JWT issued.
2. **Email verify** *(future, out of scope here — flagged TODO)*.
3. **ID verification gate** — on first login (or any session whose
   `user.is_verified === false`), the app routes to `/verify`. Discover,
   Matches, Chat, Rooms are all wrapped in `<RequireVerified>` and redirect to
   `/verify` if `is_verified !== true`.
4. **Start verification** — user taps "Start verification" on `/verify`.
   Frontend calls `POST /api/verify/start`. Backend creates a Stripe Identity
   `VerificationSession` with `type: 'document'` and
   `options.document.require_matching_selfie: true`. Backend returns the
   session's `client_secret` and persists `verification_session_id` on the
   user row, transitioning `verification_status` to `pending`.
5. **Hosted Stripe flow** — frontend calls
   `loadStripe(VITE_STRIPE_PUBLISHABLE_KEY).then(s => s.verifyIdentity(client_secret))`.
   Stripe handles ID upload + selfie + liveness in their hosted modal. On
   close, the modal resolves with `{error?}` — frontend routes to
   `/verify/pending` on success or back to `/verify` with an error message.
6. **Stripe processes the submission** — typically seconds to minutes. Stripe
   POSTs to our webhook.
7. **Webhook** — `POST /api/verify/webhook` receives signed events from
   Stripe. We handle:
   - `identity.verification_session.verified` → set `is_verified = true`,
     `verification_status = 'verified'`, `verified_at = NOW()`,
     `rejection_reason = NULL`.
   - `identity.verification_session.requires_input` → set
     `verification_status = 'rejected'`, store
     `last_error.reason` into `rejection_reason`.
   - `identity.verification_session.canceled` → set
     `verification_status = 'unverified'` so the user can restart.
8. **Polling** — `/verify/pending` polls `GET /api/verify/status` every 5s.
   On `verified` it routes to `/discover`. On `rejected` it routes to
   `/verify/rejected` with the reason.
9. **Access granted** — `<RequireVerified>` now passes; user sees Discover,
   Matches, Chat, Rooms. Their map marker and profile show a copper checkmark
   badge.

## DB columns (added by `database/migrations/006_verification.sql`)

Added to `users`:

| Column | Type | Default | Notes |
|---|---|---|---|
| `is_verified` | `BOOLEAN` | `FALSE` | Single source of truth for gating |
| `verification_status` | `TEXT` | `'unverified'` | One of: `unverified`, `pending`, `verified`, `rejected` |
| `verification_session_id` | `TEXT` | `NULL` | Stripe Identity session id (`vs_...`) |
| `verified_at` | `TIMESTAMPTZ` | `NULL` | When status flipped to `verified` |
| `rejection_reason` | `TEXT` | `NULL` | From Stripe `last_error.reason` |

Index: `idx_users_verification_status` on `verification_status` for quick admin
filtering ("show me all pending").

Migration is idempotent (`DO $$ ... EXCEPTION WHEN duplicate_column`).

## Backend endpoints (`backend/src/routes/verify.ts`)

All auth-gated EXCEPT `/webhook`. The webhook is Stripe-signed.

### `POST /api/verify/start`
- Auth: required.
- Behaviour: if user already `verified`, returns `400 already_verified`. If
  user has a `pending` session, reuses it (idempotent). Otherwise creates a
  new Stripe `VerificationSession`, persists session id, sets status to
  `pending`.
- Response: `{ client_secret: string, status: 'pending' }`.
- Failure modes: `503 stripe_not_configured` if `STRIPE_SECRET_KEY` unset.

### `POST /api/verify/webhook`
- Auth: NONE. Stripe signs the request. We verify with
  `stripe.webhooks.constructEvent(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET)`.
- Body parsing: needs `express.raw({ type: 'application/json' })` for this
  route specifically (Stripe SDK requires the raw bytes).
- On signature failure: `400 invalid_signature`, no DB write.
- Events handled:
  - `identity.verification_session.verified` → mark verified.
  - `identity.verification_session.requires_input` → mark rejected, capture
    `last_error.reason` and `last_error.code`.
  - `identity.verification_session.canceled` → reset to `unverified`.
- Other events → 200 ack, no-op.

### `GET /api/verify/status`
- Auth: required.
- Response: `{ is_verified: boolean, status: 'unverified'|'pending'|'verified'|'rejected', verified_at: string|null, rejection_reason: string|null }`.

## Frontend

### Routes (`frontend/src/App.tsx`)

- `/verify` → `<Verify />` (CTA + start button). Auth-gated, NOT verify-gated.
- `/verify/pending` → `<VerifyPending />` (poll status). Auth-gated.
- `/verify/rejected` → `<VerifyRejected />` (show reason + retry CTA).
  Auth-gated.

### `<RequireVerified>` guard

Mirrors `ProtectedRoute` but additionally checks `user.is_verified`. If
falsy, redirects to `/verify`. Wraps Discover, Matches, Conversations,
Messaging, Rooms, RoomChat. Profile pages stay accessible (you should always
be able to see/edit your own profile).

### State

Extend `useAuthStore.user` with:

```ts
is_verified?: boolean;
verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
```

After `loadStripe(...).verifyIdentity(...)` resolves, the page navigates to
`/verify/pending`, which polls `/api/verify/status` every 5s. When
`is_verified` becomes true, it patches the store via a new `setVerified`
action and routes to `/discover`.

### Verified badge

`PulsingAvatar` gains an optional `isVerified?: boolean` prop. When true, a
small copper checkmark badge renders bottom-right of the avatar. Default
false to preserve existing call sites. Used by `MapMarker`, `UserCard`,
`ProfileCard`, `ProfileDrawer`.

## Premium hook

The badge is **free for all verified users** (per CLAUDE.md: "ID verification
with verified badge is available to ALL users, free or paid"). Premium tier
gets *additional* visual flair (priority sort, bigger marker) — out of scope
for this PR but accommodated by the data model (we store status, not tier).

## Cost

Stripe Identity is **~$1.50 per completed verification** (US/EU document +
selfie). At 10k MAU with ~50% verification rate that is ~$7.5k/mo. Free for
unsubmitted attempts.

## Failure modes & UX

| Scenario | Stripe event | Our status | UX |
|---|---|---|---|
| User uploads bad photo (blurry, partial) | `requires_input` w/ `last_error.code = document_unverified_other` | `rejected` | `/verify/rejected` shows reason, CTA "Try again" creates new session |
| Selfie doesn't match ID | `requires_input` w/ `last_error.code = selfie_face_mismatch` | `rejected` | Same — user can retry once. After 3 attempts, soft-flag for manual review (TODO post-MVP) |
| User cancels modal | `canceled` | `unverified` | `/verify` shown again, no error |
| Session expires (24h) | `canceled` | `unverified` | Same |
| Stripe outage | session creation throws | n/a | `503 stripe_not_configured` or `502 stripe_error`, user sees retry CTA |
| Keys missing | env unset | n/a | `POST /api/verify/start` returns `503 stripe_not_configured` |

## Env vars

### Backend (`backend/.env`)
```
STRIPE_SECRET_KEY=sk_test___SET_ME__
STRIPE_WEBHOOK_SECRET=whsec___SET_ME__
```

### Frontend (`frontend/.env`)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test___SET_ME__
```

## Webhook setup (manual, post-deploy)

1. In Stripe dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://api.menrush.com/api/verify/webhook`
3. Events: `identity.verification_session.verified`,
   `identity.verification_session.requires_input`,
   `identity.verification_session.canceled`.
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` on Railway.

For local dev, use `stripe listen --forward-to localhost:3000/api/verify/webhook`
and copy the printed `whsec_...` into `backend/.env`.

## Security notes

- Webhook MUST verify signature; never trust unsigned bodies.
- Never log `client_secret`; redact in any error path.
- `STRIPE_SECRET_KEY` is server-only; never ship to frontend.
- Per repo CLAUDE.md, `backend/src/server.ts` and
  `frontend/src/api/client.ts` are sensitive — only the verify route mount
  was added to `server.ts`; `client.ts` was not touched.
