# Adult assurance — signup 18+ age gate (Veriff document DOB)

**PR #97 / issue #50 (Al order).** Signup hard-fails under-18. This is an **age gate**, not the optional Profile **Verified** badge, not full identity KYC, not UGC pre-moderation, and not an OSA “full compliance” claim.

## What it does

1. Before a `users` row is created, signup starts a **pre-account** Veriff session (`adult_assurance_sessions`).
2. On decision webhook (same HMAC path as identity), we read `verification.person.dateOfBirth`.
3. Age is calculated. **Under 18 → `status=underage`**. No account. No DOB/PII retained on our side beyond the Veriff session id for audit.
4. **18+ and approved →** one-time `adult_assurance_token`; `POST /auth/register` redeems it and sets `users.verified_age_18_plus = true` + `age_assurance_status = 'confirmed'`.
5. Rejection UI: `/register/underage` — clear 18+ only copy; explicitly **not** Verified / KYC / OSA marketing.

## What it is not

| Concept | This gate | Optional Verified badge |
| --- | --- | --- |
| When | Signup, before account | Profile → Get verified (optional) |
| Proof | Document DOB → calendar age ≥ 18 | ID + selfie approved by Veriff |
| Column | `verified_age_18_plus` | `is_verified` + `verification_provider='veriff'` |
| Under-18 | No user row | N/A (no account to badge) |

Do **not** say in product UI or PR copy that “all users are ID-verified.”

## Env

| Var | Purpose |
| --- | --- |
| `VERIFF_API_KEY` / `VERIFF_SHARED_SECRET` | Existing Veriff credentials (reuse — no second vendor) |
| `ADULT_ASSURANCE_SIGNUP_REQUIRED` | `true` / `false` override. Default: required when Veriff is configured |
| `ADULT_ASSURANCE_ALLOW_TEST_FIXTURE` | Non-prod only. Enables `/api/auth/adult-assurance/fixture` and fixture start without Veriff |

Production never enables the fixture (`NODE_ENV=production` hard-bans it).

## API

- `GET /api/auth/adult-assurance/required`
- `POST /api/auth/adult-assurance/start`
- `GET /api/auth/adult-assurance/:sessionId` (issues token when `passed`)
- `POST /api/auth/adult-assurance/:sessionId/submitted`
- `POST /api/auth/adult-assurance/fixture` (non-prod / BOA90)
- Register body may include `adult_assurance_token`

Identity webhooks remain on `/api/verify/veriff/webhook` (and alias). `applyDecision` tries adult-assurance sessions first, then identity.

## Migration

`057_verified_age_18_plus.sql` — `users.verified_age_18_plus` + `adult_assurance_sessions` (no DOB column).

## BOA90 owner test notes (Product / Zoul gate — do not self-merge)

Owner account is adult. Use the **controlled fixture** for under-18; do not use a real underage document.

### Staging / local (fixture)

```bash
# backend .env (never production)
ADULT_ASSURANCE_ALLOW_TEST_FIXTURE=true
ADULT_ASSURANCE_SIGNUP_REQUIRED=true
# Veriff keys optional when fixture is on
```

1. **Under-18 rejection (no user row)**  
   Open `/register?adultFixture=underage`, complete the form as usual, submit.  
   Expect redirect to `/register/underage` with clear 18+ copy.  
   SQL: no new `users` row for that email; `adult_assurance_sessions.status = 'underage'`; no DOB stored.

2. **18+ signup**  
   Open `/register?adultFixture=adult` (or live Veriff with an adult test document).  
   Expect account creation with `verified_age_18_plus = true`.  
   Confirm Profile **Verified** badge is still **absent** until optional Get verified.

3. **Owner (BOA90) login**  
   Existing adult owner account continues to work. This PR does not lock legacy members out of Discover for missing `verified_age_18_plus` (signup gate only). Optional later: identity Veriff DOB can set the flag.

4. **Copy check**  
   Rejection + register helper must not claim full ID verification, KYC, UGC moderation, or OSA compliance.

## Tests

```bash
cd backend
npm run test:adult-assurance
npm run test:veriff
```
