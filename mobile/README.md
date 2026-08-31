# MenRush mobile helpers

This package holds React Native-facing identity verification helpers.

## Veriff (`@veriff/react-native-sdk@13.2.0`)

1. Authenticated app calls `POST /api/verify/veriff/session` → `{ sessionId, sessionUrl }`
2. Launch: `launchVeriffIdentityCheck(sessionUrl)` (wraps `VeriffSdk.launchVeriff`)
3. User scans ID + takes selfie inside Veriff
4. **Do not** treat SDK `statusDone` as verified — wait for `is_verified` from
   `GET /api/verify/status` or socket `verify:decision` after the decision webhook

Web uses the same `sessionUrl` via `window.location.assign` in `VerifyVeriff`.
