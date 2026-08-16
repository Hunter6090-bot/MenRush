# Adult Assurance enforcement (issue #50)

Mandatory, **backend-controlled** gate before Discover, Matches, Messaging, and other member social surfaces. Frontend redirects are not sufficient.

## Product rules (signed off)

| Rule | Behaviour |
| --- | --- |
| Default | Enforcement **ON** in all environments unless explicitly disabled |
| Legacy users | **Not grandfathered** — `self_attested` / DOB-only accounts must complete Adult Assurance |
| Confirmed only | Only `age_assurance_status = 'confirmed'` unlocks gated routes |
| Separate gates | Premium and government-ID verification never satisfy Adult Assurance |
| Provider outage | **Hard-block** gated routes; keep `/api/verify/status`, `/api/verify/adult/start`, `/api/verify/adult/retry` open with machine-readable state |

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
| `ADULT_ASSURANCE_ENFORCEMENT_DISABLED` | unset (enforce) | **Rollback only.** Set `true` to disable the gate. |
| `ADULT_ASSURANCE_PROVIDER` | `none` | `stub` enables local/test completion; `none` = provider unavailable |
| `ADULT_ASSURANCE_PROVIDER_UNAVAILABLE` | unset | Force unavailable (outage drills / CI). Overrides stub. |

### Rollback

1. Set `ADULT_ASSURANCE_ENFORCEMENT_DISABLED=true` on the backend host and restart.
2. Gated routes open again; status still reports `gate_enforced: false`.
3. Clear the variable to re-enable. Prefer fixing the provider over leaving the kill switch on.

### Local / CI provider stub

```bash
ADULT_ASSURANCE_PROVIDER=stub
# optional outage simulation:
# ADULT_ASSURANCE_PROVIDER_UNAVAILABLE=true
```

Then:

```http
POST /api/verify/adult/start
POST /api/verify/adult/complete  { "session_id": "...", "outcome": "confirmed" }
# or outcome: "failed" then POST /api/verify/adult/retry
```

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

Provider down:

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

`GET /api/verify/status` includes an `adult_assurance` object with the same fields for client UX.

## Privacy / data minimisation

Stored / returned:

- `users.age_assurance_status`, `users.age_assured_at`
- `adult_assurance_sessions`: session id, user id, provider name, status, timestamps

Never stored by this flow:

- DOB copies from a third party, document numbers, selfies, raw provider payloads

## Tests

```bash
cd backend && npm run test:security
```

CI runs `test:security` on every PR to `main` (not only the opt-in predeploy script).
