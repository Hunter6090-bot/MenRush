# Release readiness — 24 September 2026

This is the originating UI/age task’s handoff snapshot. The coordinating task subsequently integrated this patch with Verotel, reran the complete checks, and prepared the release draft. See [the current release matrix](release-matrix-2026-09-24.md) and [the billing contract](verotel-release-contract.md) for the combined scope and remaining gates. Statements below about no PR or billing implementation describe this earlier handoff only.

## Verified live state

GitHub `main`, Railway production deployment `8c952cd0-1007-495c-8cfa-6c099328a8d6` (SUCCESS), and Vercel production deployment `dpl_2KEdyySqcuvqH5hsK7uHTDF8aVTF` (READY) point to `384dba685688e2951166379355b2d9c4a3f3d682`. Railway backend source is `main`, root `/backend`, healthcheck `/api/health`. Vercel production reports `githubCommitRef=main`.

Railway production's rendered variable-name inventory contains none of `VERIFF_AGE_ESTIMATION_API_KEY`, `VERIFF_AGE_ESTIMATION_SHARED_SECRET`, or `VERIFF_AGE_ESTIMATION_API_BASE`. Values were redacted by the connector and were not retrieved. The live public `/api/auth/adult-assurance/required` endpoint returned `{"required":false,"fixtureAllowed":false}`.

**Deployment remains blocked:** the mandatory patch would block signup and affected existing users until the separate provider integration is configured and validated. Do not substitute the ordinary IDV keys or disable the age requirement to release it.

## Local integration

The old temporary checkout was absent. Recovered the saved patch into `/private/tmp/menrush-release-20260924`, on a local `mvp-complete` branch based on `384dba6`. The shared repository checkout and remote branches were not changed.

The four newer commits (#290–293) remain in the baseline. Three-way application reconciled package scripts; manual Discover conflict resolution retained the extracted wrapping map controls and pointer-up/keyboard handler. This preserves tap expansion without allowing an after-swipe click to reopen the panel. The newer match/unmatch, message menu and receipt changes remain.

Remote `mvp-complete` remains `ae41505`, an ancestor 63 commits behind this production baseline. A reviewed reconciliation into `mvp-complete` is required; no force push, merge or branch retargeting was performed. Session rules require draft PRs targeting `mvp-complete` and leave merging to Al. Deployment branch settings remain `main`; changing them is a separate coordinated release decision, not an implied part of local branch reconciliation.

The optional Terms PR289 is not compatible with this mandatory assurance requirement. PR273 is an older repair and was not cherry-picked. PR286 also reserves migration number067; the new age patch uses067, so any combined invoice release must reconcile migration names first. Separate Verotel implementation work is owned by the coordinating task and is not included in this patch.

## CI and validation

Added `mvp-complete` to both CI and browser-smoke PR filters. Added independent Chromium, WebKit and Firefox compatibility jobs using local fixtures, with test artifacts. Added full frontend test commands to CI and Node22 for that frontend job. Two new upstream Node-runner tests were missing from Vitest exclusions; they now run in `test:unit`, not under both runners.

Both local builds passed. Full Vitest suite: 100 files / 473 tests passed. Node test suite: 30 tests passed. Backend age-policy, security (9), billing-disabled, Veriff and rate-limit checks passed. PostgreSQL transactional checks from22 September are historical evidence, not newly rerun in this refresh.

The first browser run passed80 checks and hit one connection refusal while Vite configuration was being updated. Final rerun: all81 tests passed in46.3 seconds (zero failures or retries). No production API, live user or provider session was used by the browser matrix.

## Browser coverage and remaining device evidence

Automated coverage uses three browser engines, six viewport sizes (320×568,360×800,844×390,768×1024,1024×768,1440×900), light/dark, touch capability, keyboard interaction, denied geolocation, draft-preserving update confirmation, and existing-session age-gate enforcement with local API fixtures. It does not prove native mobile browser behavior, actual software keyboards, live maps or installed PWA service-worker updates.

Before release, record device/OS/browser versions and evidence for iPhone Safari (browser and installed PWA), Android Chrome (browser and installed PWA), iPad Safari portrait/landscape, and desktop Safari/Chrome/Firefox. Exercise signup/recovery after provider activation, allow/deny location, map tap/swipe, overlays, keyboards, light/dark changes, and foreground/background update handling with an unsent draft. No physical-device or device-farm execution was performed here; device access is still required.

## Release order

1. Provision and validate the separate Age Estimation integration and hosted selfie-only flow; configure all three age settings and the authenticated decision webhook. Confirm provider policy and anti-spoof settings.
2. Review the reconciled branch/patch and any independently developed billing changes. Resolve migration-number overlaps. Follow the required draft-PR and owner-merge process.
3. Apply the additive age-evidence migration before the repaired backend starts, then coordinate backend/frontend production deployment. Historical approvals are not grandfathered; users need recovery assurance.
4. Verify deployed commit identities, health, required/available status, hosted decisions and affected-user recovery before calling the release complete.

No commit, push, PR creation, merge, migration, production deployment or provider-setting change was made by this refresh.
