# Adult assurance — signup dual path (Veriff liveness + optional ID)

**PR #97 / issue #50 (Al order, 2026-09-12).** Signup hard-fails under-18. Required path is **liveness / age-estimation selfie**, not document DOB. Optional ID in the same flow awards the **Verified tick**. Not full identity KYC for all members, not UGC pre-moderation, not an OSA “full compliance” claim.

## What it does

1. Before a `users` row is created, signup starts a **pre-account** Veriff liveness session (`adult_assurance_sessions`, `check_kind=liveness`).
2. On decision webhook: read `additionalVerifiedData.estimatedAge` when present. Under 18 → `status=underage`, no account. Approved with no underage signal → pass + one-time `adult_assurance_token`. **No DOB required.** MenRush does not keep copies of ID documents (Veriff processes as processor).
3. After liveness pass, UI offers optional ID: “Want a Verified tick?” Add ID with Veriff / Skip.
4. If Yes: second Veriff ID session (`check_kind=id`, linked via `parent_session_id`). Approved → parent `id_verified=true`.
5. `POST /auth/register` redeems the token → `verified_age_18_plus=true`. If `id_verified`, also sets `is_verified` + `verification_provider='veriff'` (Verified tick).
6. Rejection UI: `/register/underage`.

## What it is not

| Concept | Required gate | Optional Verified tick |
| --- | --- | --- |
| When | Signup, before account | Same signup flow or Profile later |
| Proof | Liveness / age-estimation selfie | ID document check via Veriff |
| Column | `verified_age_18_plus` | `is_verified` + `verification_provider='veriff'` |
| Under-18 | No user row | N/A on liveness fail |

Do **not** say “all users are ID-verified.”

## Face copy (Al skim)

| Screen | Copy |
| --- | --- |
| A Intro | **Quick selfie.** Confirms you're 18+. Takes about ten seconds. Card: Powered by Veriff / Optional ID later for a Verified tick / MenRush never keeps copies of your ID. CTA: Continue with Veriff. Link: How it works |
| B Progress / success | Opening Veriff… / 18+ confirmed. Age check done. |
| C Upsell | **You are through.** Selfie confirmed via Veriff. Card: Want a Verified tick? / Add ID with Veriff / MenRush never keeps copies of your ID. Add ID with Veriff / Skip |
| D ID success | Verified tick earned. Separate from the age gate you already passed. |
| E Fail | MenRush is 18+ only. Age check failed. No account was created. |

Source of truth in UI: `frontend/src/components/AdultAssuranceFlow.tsx` → `ADULT_ASSURANCE_COPY`.

## Env

| Var | Purpose |
| --- | --- |
| `VERIFF_API_KEY` / `VERIFF_SHARED_SECRET` | Veriff credentials (ID path + default) |
| `VERIFF_AGE_ESTIMATION_API_BASE` | Optional Age Estimation base URL for liveness start |
| `VERIFF_AGE_ESTIMATION_API_KEY` | Optional Age Estimation API key (falls back to `VERIFF_API_KEY`) |
| `ADULT_ASSURANCE_SIGNUP_REQUIRED` | `true` / `false` override. Default: required when Veriff configured |
| `ADULT_ASSURANCE_ALLOW_TEST_FIXTURE` | Must be `true` for `/fixture` |
| `ADULT_ASSURANCE_STAGING_FIXTURE` | Escape when Railway staging has `NODE_ENV=production` |
| `RAILWAY_ENVIRONMENT` / `RAILWAY_ENVIRONMENT_NAME` | If name contains `staging`/`stage`, fixtures allowed |

## API

- `GET /api/auth/adult-assurance/required`
- `POST /api/auth/adult-assurance/start` — liveness session
- `POST /api/auth/adult-assurance/:sessionId/start-id` — optional ID after liveness passed
- `GET /api/auth/adult-assurance/:sessionId` — status + token when passed; includes `id_verified`
- `POST /api/auth/adult-assurance/:sessionId/submitted`
- `POST /api/auth/adult-assurance/fixture` — BOA90 outcomes: `underage` \| `adult` \| `adult_with_id` \| `declined` \| `failed`
- Register body: `adult_assurance_token`

## Migrations

- `058_verified_age_18_plus.sql` — `users.verified_age_18_plus` + `adult_assurance_sessions` (057 taken by outdoor Hot Spots on main)
- `059_adult_assurance_liveness_id.sql` — `check_kind`, `parent_session_id`, `id_verified`, `id_session_id`

## BOA90 fixtures (staging)

```bash
ADULT_ASSURANCE_ALLOW_TEST_FIXTURE=true
ADULT_ASSURANCE_SIGNUP_REQUIRED=true
```

1. **Underage** — `/register?adultFixture=underage` → `/register/underage`, no user row.
2. **Adult liveness-only** — `/register?adultFixture=adult` → account with `verified_age_18_plus=true`, **no** Verified tick.
3. **Adult liveness+ID** — `/register?adultFixture=adult_with_id` → account with Verified tick (`is_verified`).

## Tests

```bash
cd backend
npm run test:adult-assurance
npm run test:veriff
```
