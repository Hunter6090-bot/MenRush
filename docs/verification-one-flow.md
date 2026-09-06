# Veriff-only verification — 5 September 2026

Owner decision: verification is free and optional. Veriff is the only provider that can award the Verified badge.

## User flow

Profile has a single Get verified action beneath the profile identity. It creates or resumes the authenticated user's Veriff session and opens the existing InContext SDK immediately. Cancel returns to Profile; unfinished sessions can be resumed. Submission shows progress, never an approval. Profile refreshes from the server on provider socket events, return/focus, and every 10 seconds while pending and visible.

Approved checks show Verified beside the name and a small copper tick at the bottom-right of grid photos. The accessible badge opens a short explanation on tap. Unverified profiles have no badge. Completed sessions, resubmission requests, rejection and expiry have distinct handling, without a loading-page loop.

## Removed paths

Trust Centre and the old introduction, country/ID capture, handoff scan, manual fallback, liveness-only, pending and rejected pages are retired. `/verify/*` bookmarks redirect to Profile. Old upload APIs return 410 before file parsing. Manual/admin identity approval is disabled; administrative revocation and historical file cleanup remain available. Test-account creation no longer awards a verification badge.

Public profile, discovery, room and auth badge projections require both `is_verified` and `verification_provider = 'veriff'`. Historical manual/test badges therefore stop displaying as Verified. This does not delete accounts or change their stored historical records. Such users can complete Veriff from Profile.

## Server behaviour

Only authenticated Veriff decision webhooks or signed decision retrieval can approve a current, known session. Existing missed-webhook recovery and referral rewards are preserved. Recovery also includes submitted and review sessions. Unknown, superseded and non-decision statuses do not grant badges. Late declines cannot overwrite an approved session. Session and user decision updates use one atomic SQL statement, so failed writes can be retried. Session resumption is resolved server-side by the authenticated user's current session; another user's browser-stored URL is never reused. Provider session requests time out after 15 seconds.

## Release requirements

Deploy frontend and backend together. No new migration or environment variable is introduced. The existing `database/migrations/043_veriff_sessions.sql` and verification user columns must already be present. Existing `VERIFF_API_KEY`, `VERIFF_SHARED_SECRET`, `FRONTEND_URL` and optional `VERIFF_API_BASE` still apply. `VITE_FEATURE_VERIFF` no longer hides the opt-in Profile action.

Confirm the provider integration uses Veriff-managed decisions. Veriff's explicit `review` status means a review on the customer's side; the app does not implement a new MenRush approval queue. No live provider configuration was changed in this task.

## Validation

- Frontend and backend production builds pass. Existing frontend bundle-size/circular-chunk warnings remain.
- 16 focused frontend tests pass: one-click launch, duplicate-click suppression, unavailable provider, cancellation/resume, no badge on submission, approved refresh, resubmission/expiry/rejection/review, accessible badges and profile normalization.
- Backend offline tests execute the real decision service with mocked database results: HMAC validation, all decisions, unknown/superseded sessions, approved idempotence, resume and manual-grant protection.
- Real isolated PostgreSQL tests with fake records pass: UUID/text session joins, submission, all six decision results, old manual-badge provenance, atomic rollback and successful retry.
- Browser checks use local test API responses and a stub provider frame: Profile renders at 390px and desktop widths; one click opens the SDK frame without leaving Profile; old URLs redirect; grid badge is inside the bottom-right of its photo; tapping it explains verification without opening the profile. No real ID or selfie was submitted.

Live Veriff camera capture, provider review configuration and a production webhook round trip remain release checks. Production deployment was authorized by the owner on 6 September 2026. The release is based on production commit 6430aba and preserves its chat, rooms, referrals and Veriff recovery changes. No new database migration is required.
