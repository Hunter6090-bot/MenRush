# Mandatory age assurance and optional ID

Local repair against production-source commit `167e9c8`, 22 September 2026. This document describes the proposed implementation, not live activation or a legal compliance certification.

Signup always requires a one-time token from a positive, authenticated Veriff Age Estimation result. DOB/self-declaration, a standalone liveness approval, a client flag, and the optional ID Verified badge cannot satisfy this check. No skip is offered. Provider configuration failure blocks new checks rather than changing the requirement.

Veriff documents a separately provisioned Age Estimation integration, its own key/base URL, and selfie-only hosted capture. The decision includes a numeric `verification.additionalVerifiedData.estimatedAge`. See [Age Estimation](https://devdocs.veriff.com/docs/age-estimation). Provisioning and the suitability of the provider's age/anti-spoof configuration must be verified with the provider before launch; merely setting environment variables does not prove activation.

## Configuration and provider routing

Required age-only settings:

- `VERIFF_AGE_ESTIMATION_API_KEY`
- `VERIFF_AGE_ESTIMATION_SHARED_SECRET`
- `VERIFF_AGE_ESTIMATION_API_BASE` — the explicit HTTPS base supplied for that integration.
- `FRONTEND_URL` — callback origin.

Optional document verification continues to use `VERIFF_API_KEY`, `VERIFF_SHARED_SECRET`, and `VERIFF_API_BASE`. The age key cannot equal the ID key; there is no credential/base fallback and no undocumented `selfid` feature override.

Configure the Age Estimation decision webhook as `/api/verify/veriff/webhook` (existing `/api/verify/webhook` alias also supported). The handler verifies the original raw body with the matching integration key and secret, then routes age credentials only to liveness rows and ID credentials only to ID rows. It never links unknown sessions using vendorData. Veriff specifies raw-body HMAC for webhooks and exempts session creation from request HMAC: [authentication contract](https://devdocs.veriff.com/docs/hmac-authentication-and-endpoint-security).

A passing age decision requires status `approved`, numeric code `9001`, and a finite numeric estimated age at least 18 (valid range 0–120). Numeric strings, missing evidence, DOB alone, and inconsistent codes do not pass. Explicit underage evidence revokes a prior pass. Terminal denial/expiry/failure cannot be replayed into approval; resubmission/review may advance after a valid provider decision. See [decision webhook](https://devdocs.veriff.com/v1/docs/decision-webhook).

The code stores the provider session, decision outcome/code, evidence version and redemption binding. It does not persist the estimated age, document DOB, images or decision payload. ID verification remains optional after the age check. A contradictory underage ID outcome revokes the parent age evidence.

## Signup and existing accounts

- `GET /api/auth/adult-assurance/required` returns `required: true`, availability and fixture availability, with no-store caching.
- Public start/status/submitted and optional start-ID routes serve unregistered users. Tokens expire 30 minutes after approval, cannot be extended through polling, and are consumed atomically in the registration transaction. Polling rotates the token; the optional-ID completion step obtains the latest token before registration.
- `GET /api/auth/adult-assurance/account` reports current server-side clearance for a signed-in account.
- Account start/status/complete routes bind the session and redemption to the authenticated user. An account token cannot be redeemed as signup or by another account.
- `/age-assurance` provides existing-account recovery. Login/refresh can establish a session for recovery, but do not confer product access.
- Protected HTTP routes, socket authentication/events, and signed album/message media check current evidence. Cached user flags, existing JWTs and ID badges do not bypass the gate. Password change, account deletion and logout remain possible without an age pass.

## Migration and release impact

Apply `067_mandatory_age_evidence.sql` before starting the repaired backend. Both migration directories contain the identical file. It adds evidence version, account binding and fixture provenance to existing sessions. No live migration has been applied.

**Existing approvals remain evidence version 0.** Historical approved-without-age sessions and DOB-only accounts must re-assure. Deploying this patch before the real Age Estimation integration is available will block new signup and product access for accounts without new trusted evidence. This is intentional fail-closed behavior and requires a coordinated release. Do not backfill evidence version 1 from old booleans or ID badges.

`ADULT_ASSURANCE_SIGNUP_REQUIRED=false` no longer disables the requirement. Fixtures require exactly `NODE_ENV=test` plus `ADULT_ASSURANCE_ALLOW_TEST_FIXTURE=true`; production/staging override flags cannot enable them in a production runtime. Fixture rows cannot confer product access.

## Local verification

- `npm --prefix backend run test:adult-assurance`: offline age-policy/numeric/HMAC checks.
- `npm --prefix backend run test:mandatory-age`: signed HTTP callbacks, token/transaction/access behavior against an isolated PostgreSQL instance. Requires `AGE_TEST_PG_SOCKET` pointing to a private `/private/tmp/` Unix-socket directory, port 55437, user `age_test`, database `postgres`. Creates a random schema and removes it after testing; ignores `DATABASE_URL`.
- Existing Veriff, security, billing-disabled and rate-limit checks; both builds; focused frontend unit checks; browser parity suite.

No real provider sessions, biometric submissions, vendor account configuration, live users, deployment, or production database were used. Hosted selfie behavior and physical-device verification remain release validation tasks after provider activation.
