# Current-source compatibility and billing remediation — 22 September 2026

## Baseline and isolation

Independent checkout: `/private/tmp/menrush-current-review`, local branch `mvp-complete`, baseline `167e9c8e3cf159b7172af2f85dbce08b0834124a`. This is the production source identified by the read-only diagnostic task. Git ancestry confirms it includes all 59 commits after the old `mvp-complete` head `ae41505`. No shared branch reference, original `/Users/alzain/em` file, remote PR, deployment, or merchant configuration was modified. No commit or push was made.

The original f8d3 worktree still contains the superseded patch against ae41505. It was preserved in `/private/tmp/menrush-parity-preserved`; **do not deploy that older checkout or restore its removed billing provider**. This new patch is based on current Verotel source. PR #290 was reviewed as a reference; only relevant map interaction improvements were adapted. It remains unmerged and unchanged.

## What changed

- **Legacy avatar recognition:** `profileMedia.ts` recognises reserved `/avatars/` placeholders in relative and absolute URLs, including query strings. Shared avatar/photo resolvers and profile forms use it. The existing current `FadedBrandFace` profile/tile/pin styles and real-photo loading behaviour are preserved. Failed photo candidates fall back to the current design. Uploaded media URLs and database records are unchanged. COSTAMAN1965's stored record was not queried.
- **Map layout:** extracted the actual `MapFloatingChrome` component so desktop/mobile use one testable implementation. Discretion controls and action buttons wrap; action targets are at least 44px; search, disclaimer and privacy copy flow below controls rather than using conflicting absolute offsets. Expansion no longer depends on a location result. Handle taps and swipes are distinguished, and keyboard operation is implemented. No browser-name branch was added.
- **Additional full-shell defect found by tests:** with location denied, duplicate notices and a narrow flex text column could consume the phone viewport and put map controls under bottom navigation. The duplicate activation notice is suppressed, notices get a bounded scroll area, and activation-banner text/actions wrap with usable widths.
- **Long-running sessions:** build emits `app-version.json`; a shared notice checks on visible return and periodically, offering Refresh/Later. Nothing auto-reloads. Refresh requires explicit confirmation warning about unsaved changes/drafts/calls. This works in the web app code used by installed apps, but physical installation/background-resume is not claimed tested. Already-running old bundles need an initial manual reload to acquire this capability. The service worker does not cache application responses; no cache fault is asserted.
- **Billing containment:** checkout stays disabled. The public callback route and direct service entry point fail closed with `billing_not_configured`. Removed the unsafe unsigned activation/renewal/deactivation functions rather than retaining callable paths with forged user IDs. GET/POST/other callbacks cannot modify subscription, user or referral state. No callback is acknowledged as successfully processed. No migrations, new production env variables, or secrets are introduced. Advertised price remains £6.99 and free radius remains 5km.

## Payment integration still required

Official [Verotel subscription documentation](https://controlcenter.verotel.com/flexpay-doc/subscription.html) describes signed GET postbacks, provider sale/reference identifiers and a specific success acknowledgement; the removed generic JSON/event handler was not that contract. No signature algorithm or production checkout wiring is invented here.

Before accepting payments: verify merchant approval, enabled GBP subscription product, configured postback version and official signing contract using legitimate merchant configuration and sample payloads. Then implement a server-created checkout reference bound to the user/product/amount, signature verification, durable unique event tracking, replay/order policy, provider-sale ownership checks, transactional subscription/entitlement writes, and paid-through cancellation/expiry/refund semantics. Run provider-authorized sandbox lifecycle tests. There is no live signature verification, active deduplication or transaction-based payment processor in this patch: **all events are rejected**, including duplicates and reordered events. Rejection makes current attacks inert; it is not completed payment integration.

No real charge, outbound vendor message, production webhook, database connection or live authenticated API was attempted. Merchant activation status is still unverified. Confirm production has no legitimate active postback processing before deploying this containment change; checkout is disabled in the reviewed source, but backend deployment identity was not independently proven here.

## Verification and scope

- Frontend production build and backend TypeScript build pass. Existing Vite warnings: circular socket/vendor chunk, empty heic chunk, large Mapbox chunk and old Browserslist data.
- 58 focused unit tests pass across 12 files: current avatar styles, legacy/failing media, preview/profile/matches/chat faces, profile setup, activation banner, URL resolution and safe update notice.
- Billing checks pass: attempted success/failure/cancellation events, repeated and reordered requests, forged user/subscription IDs, and route GET/POST/PUT return unavailable with **zero DB calls**. Synthetic environment values cannot enable checkout.
- Final browser run: **78 passed in 44.5s**. Browser matrix uses Chromium, WebKit and Firefox at 320×568, 360×800, 844×390, 768×1024, 1024×768 and 1440×900 in light/dark themes. Phone/tablet-size fixtures exercise touch; keyboard focus and Enter are tested. Checks cover map bounds/targets/overlays, legacy preview, login/register/password-reset forms, 16px fields, input retention when viewport height shrinks, submit-button scrolling and update cancellation/postponement. A separate actual Discover-shell test uses a synthetic complete profile and denied location to check expand, shrink, keyboard, tap and swipe.
- Fixtures intercept API/network access; the full-shell case closes test WebSockets. Service workers are blocked during the matrix to keep requests isolated. Mapbox/GPS backend, real account transitions, real payment flows, push/video/camera, OS virtual keyboards/autofill, text scaling, hardware safe areas, and physical installed-app updates remain release QA gaps. Browser engines and viewport/touch emulation do not prove support on every device.
- Initial tests exposed missing Firefox/WebKit runtimes; installed both and reran. Node 25's experimental global Web Storage conflicted with jsdom; unit tests pass with `NODE_OPTIONS=--no-experimental-webstorage`, with no application workaround.

## Reproduce locally

From `/private/tmp/menrush-current-review`:

```sh
npm ci --prefix frontend
npm ci --prefix backend
npm --prefix frontend run build
npm --prefix backend run build
npm --prefix backend run test:billing-disabled
cd frontend
npx playwright install chromium webkit firefox
npm run test:compatibility
NODE_OPTIONS=--no-experimental-webstorage npm test -- src/components/AppUpdateNotice.test.tsx src/components/ProfileDrawer.test.tsx src/components/FadedBrandFace.test.tsx src/components/ConversationItem.test.tsx src/components/ActivationBanner.test.tsx src/components/ProfileCard.face.test.tsx src/components/ChatBubbleFace.test.tsx src/pages/Matches.face.test.tsx src/lib/profileSetup.test.ts src/lib/assetUrl.test.ts src/lib/nearbyPhotoSrc.test.ts src/pages/ProfileView.test.tsx
```

Browser JSON output: `frontend/test-results/compatibility.json`. Per-engine location-denied screenshots are under that test-results directory. These artifacts are test evidence, not deployment proof. Review and integrate only against the reconciled current source; release-branch/deployment alignment is still an owner/release task.
