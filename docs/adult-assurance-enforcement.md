# Adult Assurance enforcement (issue #50)

Mandatory, **backend-controlled** gate before Discover, Matches, Messaging, and other member social surfaces. Frontend redirects are not sufficient.

There is **no invented third-party age-check provider** in this codebase. Until a real provider is wired, completion is limited to a **non-production stub**.

## Product rules (signed off)

| Rule | Behaviour |
| --- | --- |
| Default | Enforcement **ON** in all environments unless explicitly disabled |
| Legacy users | **Not grandfathered** — `self_attested` / DOB-only accounts must complete Adult Assurance |
| Confirmed only | Only `age_assurance_status = 'confirmed'` unlocks gated routes |
| Separate gates | Premium and government-ID verification never satisfy Adult Assurance |
| Provider outage | **Hard-block** gated routes; keep `/api/verify/status`, `/api/verify/adult/start`, `/api/verify/adult/retry` open with machine-readable state |

## Production safety (read this before deploy)

| Do | Do not |
| --- | --- |
| Keep `ADULT_ASSURANCE_ENFORCEMENT_DISABLED=true` on production **until** a real provider exists **or** you are canary-testing | Set `ADULT_ASSURANCE_PROVIDER=stub` in production |
| Use canary subjects to test one account (below) | Leave full enforcement on with `provider=none` for all users (locks everyone) |
| Confirm a canary account via admin/SQL after verifying the 403 UX | Invent or ship a fake third-party provider |

**Stub is hard-ignored when `NODE_ENV=production`.** Even if mis-set, start/complete stay unavailable and the process logs a boot error. Production must not rely on stub.

### Recommended production posture today

```bash
# Production (no real provider yet): keep the gate OFF so members are not locked out.
ADULT_ASSURANCE_ENFORCEMENT_DISABLED=true
# Leave unset / none — never stub:
# ADULT_ASSURANCE_PROVIDER=none
```

### Safe one-account / canary test (production or shared host)

1. Leave rollback off only for the canary: clear `ADULT_ASSURANCE_ENFORCEMENT_DISABLED` (or leave unset).
2. Restrict who is gated:

```bash
ADULT_ASSURANCE_ENFORCEMENT_SUBJECTS=<owner-user-uuid-or-email>
```

Only listed members are blocked until confirmed. Everyone else passes the gate (not grandfathered forever — remove the subjects list for full rollout).

3. Do **not** enable stub in production. For the canary account:
   - Observe `403` + `adult_assurance_provider_unavailable` / `adult_assurance_required` on Discover/Matches/Chat.
   - Flip that one row with ops/admin SQL (status only — no fake provider):

```sql
UPDATE users
   SET age_assurance_status = 'confirmed',
       age_assured_at = COALESCE(age_assured_at, NOW()),
       updated_at = NOW()
 WHERE id = '<owner-user-uuid>';
```

4. Confirm gated routes open for that account only; other users unchanged.
5. When done testing, either re-set `ADULT_ASSURANCE_ENFORCEMENT_DISABLED=true` or keep canary until a real provider ships.

### Staging / local stub (never production)

```bash
NODE_ENV=development   # or test / any non-production
ADULT_ASSURANCE_PROVIDER=stub
# Optional: only the owner may self-confirm on a shared staging API
ADULT_ASSURANCE_STUB_ALLOWLIST=<owner-user-uuid-or-email>
```

```http
POST /api/verify/adult/start
POST /api/verify/adult/complete  { "session_id": "...", "outcome": "confirmed" }
```

Unset `ADULT_ASSURANCE_STUB_ALLOWLIST` on private local/CI so any test user can complete.

## Always available (no Adult Assurance required)

- Auth (login / logout / password)
- Account settings, profile edit, own photo/cover, location, visibility
- Blocking / reporting
- Adult Assurance start / retry / status / complete
- Premium plan browse / subscribe (payment ≠ trust)
- Optional authenticity / ID verification flows

## Gated surfaces

- Discovery / nearby / search / profile views / other-member profiles
- Likes / matches
- Messaging / rooms
- Pulse / events / hot spots / meet / albums / profile-meta
- Notifications list
- WebRTC ICE (voice/video)
- Socket.IO `authenticate` (realtime social)

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADULT_ASSURANCE_ENFORCEMENT_DISABLED` | unset (enforce) | **Production rollback.** Set `true` to disable the gate for everyone. |
| `ADULT_ASSURANCE_ENFORCEMENT_SUBJECTS` | unset (everyone) | Comma-separated user UUIDs and/or emails. When set, **only** these members are gated (canary). |
| `ADULT_ASSURANCE_PROVIDER` | `none` | `stub` only on **non-production**. **Never set stub in production** (ignored). |
| `ADULT_ASSURANCE_STUB_ALLOWLIST` | unset (all users on non-prod stub) | Comma-separated UUIDs/emails allowed to call stub start/complete on staging. |
| `ADULT_ASSURANCE_PROVIDER_UNAVAILABLE` | unset | Force unavailable (outage drills / CI). |

### Rollback

1. Set `ADULT_ASSURANCE_ENFORCEMENT_DISABLED=true` on the backend host and restart.
2. Gated routes open again; status still reports `gate_enforced: false`.
3. Clear the variable to re-enable. Prefer a real provider + canary over leaving the kill switch on.

## API error shape (403 / socket)

```json
{
  "error": "adult_assurance_required",
  "code": "adult_assurance_required",
  "age_assurance_status": "self_attested",
  "provider_available": true,
  "retry_allowed": true,
  "reason": "blocked_self_attested"
}
```

Provider down / production with no provider:

```json
{
  "error": "adult_assurance_provider_unavailable",
  "code": "adult_assurance_provider_unavailable",
  "age_assurance_status": "pending",
  "provider_available": false,
  "retry_allowed": true,
  "reason": "provider_unavailable"
}
```

`GET /api/verify/status` includes `adult_assurance` with `subject_to_enforcement`, `stub_allowed_for_user`, and the same access fields.

## Privacy / data minimisation

Stored / returned:

- `users.age_assurance_status`, `users.age_assured_at`
- `adult_assurance_sessions`: session id, user id, provider name, status, timestamps

Never stored by this flow:

- DOB copies from a third party, document numbers, selfies, raw provider payloads

## Tests

```bash
cd backend && NODE_ENV=test ADULT_ASSURANCE_PROVIDER=stub npm run test:security
```

CI runs `test:security` on every PR to `main` (not only the opt-in predeploy script).
