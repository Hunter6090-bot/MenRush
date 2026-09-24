# Mandatory age assurance — local review handoff

Baseline: `167e9c8e3cf159b7172af2f85dbce08b0834124a`, independent checkout `/private/tmp/menrush-current-review`, local branch `mvp-complete`. No commit, push, PR, merge, deployment, production migration, provider configuration change or biometric submission.

The combined patch preserves the previous avatar/map/update/billing containment work. PR273 supplied diagnostic context only; its stale branch was not cherry-picked. This implementation uses the current Veriff code, not the removed CCBill flow or a VerifyMy assumption.

## What changed and why

1. **Mandatory age-only provider path.** Separate Age Estimation API key, shared secret and explicit HTTPS base are required. IDV credentials cannot substitute. Session creation no longer sends the undocumented `selfid` feature. Missing configuration returns 503; the required flag remains true.
2. **Authenticated, positive evidence.** Raw-body HMAC and client key select the integration. Age and ID decisions can only update their respective session kinds. `approved`/9001 plus a numeric 18+ estimate is required; missing/invalid age, contradictory codes, underage and terminal failure cannot produce a redeemable pass. Underage evidence revokes previous age approval. Provider event payloads/biometrics are not stored.
3. **Token and account safety.** Atomic single redemption, fixed 30-minute expiry, ownership-bound account recovery, and versioned evidence. Repeated status polls cannot extend expiry. The optional-ID UI refreshes the token before registration, fixing its previous stale-token race.
4. **Access enforcement.** Existing JWTs must pass the server evidence query through protected HTTP, socket authentication/events and protected album/message media. Frontend cached ID/age flags cannot bypass the gate. Existing accounts can complete the selfie path at `/age-assurance`. Password change, deletion and logout remain available without age clearance.
5. **Optional badge preserved.** The ID step remains separate and skippable after age assurance. Ordinary IDV approval does not grant mandatory age evidence.
6. **No production fixture escape.** Fixtures require `NODE_ENV=test` and explicit fixture enablement; production/staging override variables cannot bypass this. Fixture rows cannot authorize product access.

## Validation

- Both production builds passed. Existing Vite chunk-size/circular-chunk notices remain.
- 71 focused frontend unit tests across 15 files passed, including fail-closed signup configuration, absent skip controls, optional ID skip, latest token usage and existing-account gate.
- Real isolated PostgreSQL: 63 assertions plus rejection checks passed through signed HTTP callbacks, access and recovery endpoints. Covered missing config, fake signature, wrong integration, missing/malformed/underage age, mismatched code, denial replay, resubmission, duplicate approvals, concurrent single redemption, rollback retry, expiry, legacy flag bypass, wrong-account token access/redemption, and optional ID separation/revocation. Synthetic provider responses only.
- Offline age/HMAC contract checks, existing Veriff checks, nine security checks, rate-limit checks and billing-disabled checks passed.
- 81 browser tests passed in 50.2 seconds across Chromium, WebKit and Firefox, including existing-account cached-flag bypass. Result: accompanying `compatibility.json`.
- `git diff --check` passed. Reviewed `frontend/src/api/client.ts` and `backend/src/server.ts`: no unexplained outbound HTTP additions; changes use existing first-party endpoints.

## Required release work / limits

Migration `067_mandatory_age_evidence.sql` is mirrored in both migration directories and must precede the backend release. Historical approvals remain version 0; they are not trustworthy substitutes for the new evidence contract. Existing users will need re-assurance. Deploying before provider activation would intentionally block affected users and new signup.

The actual Age Estimation integration must still be provisioned/activated and configured with the correct decision webhook and age/anti-spoof settings. Environment presence is not proof of provider activation. No live hosted-selfie flow, real phone/PWA, production email delivery or legal effectiveness assessment was performed. These remain distinct release checks. The old production `/required:false` observation has not been changed by this work.

See [implementation and configuration notes](adult-assurance-signup.md). The tested PostgreSQL instance was created solely under `/private/tmp/menrush-age-pg`; test schemas were removed and the instance stopped after verification.
