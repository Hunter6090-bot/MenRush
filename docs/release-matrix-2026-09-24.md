# Release evidence matrix

Baseline: `384dba6` in production, remote `mvp-complete` at `ae41505` (63 commits behind, no divergence). Proposed draft retains the full deployed ancestry and layers reviewable fixes on top. Neither remote branch has been changed or merged by this task.

## Automated coverage

| Area | Coverage | Evidence boundary |
|---|---|---|
| Browser engines | Chromium, WebKit, Firefox | Desktop automation engines, not real mobile hardware |
| Viewports | 320x568, 360x800, 844x390, 768x1024, 1024x768, 1440x900 | Phone/tablet portrait/landscape plus desktop |
| Appearance/input | Light/dark, touch capability, keyboard activation | Native keyboard and hardware touch still need device checks |
| Shared UI | Legacy/absolute placeholders, responsive map controls and overlays | Fixture page uses actual shared components; not a live map integration |
| Permissions | Location denial | Real OS allow/deny/reset/reinstall not tested |
| Updates | Build-change notice, Later/confirm, draft preserved before reload | Service workers blocked in emulation; installed PWA update not proved |
| Authentication | Anonymous signup fail-closed and cached-account age gate | Isolated API fixtures, not a complete real provider session |
| Billing | 59 isolated PostgreSQL/HTTP assertions | No actual merchant sandbox transactions |

Browser artifacts: `frontend/test-results/compatibility.json`; CI uploads per-engine reports. Final integrated local run: 81 browser checks, 473 Vitest tests and 30 Node tests passed. Both builds, 59 Verotel transactional checks and 63 mandatory-age database assertions passed. Node 25 required `NODE_OPTIONS=--no-experimental-webstorage` for the JSDOM unit suite; CI uses Node 22. These are local checks, not proof of GitHub CI or deployment.

## Required real-device service execution — blocked on access

No BrowserStack, Sauce Labs, LambdaTest or other physical-device connector/account was found in available tools or repository configuration. The user was asked which approved service/account to use; no new paid account or subscription was opened.

| Physical target | Required flows | Status |
|---|---|---|
| Representative iPhone / Safari | Portrait/landscape; light/dark; signup/recovery; keyboard; allow/deny location; map overlays/tap/swipe | Not run |
| Representative iPad / Safari | Same flows; both orientations; touch and attached keyboard | Not run |
| Representative Samsung / Chrome | Same flows; Android keyboard; permission recovery; map expansion | Not run |
| iPhone installed PWA | Install, background/resume, deployment update, unsent draft and active call | Not run |
| Samsung installed PWA | Install, background/resume, deployment update, unsent draft and active call | Not run |

Use named isolated QA accounts on an isolated staging backend. Record device model, OS/browser version, tested commit, environment, session URL, timestamps, screenshots/video and outcome for each cell. Do not use production customers or put credentials in reports. Device-farm browser tests do not necessarily support installation: use a service supporting that operation or physical owned devices for the PWA cells. No emulation result can waive these cells.

## Branch and deployment cutover

The draft includes all 63 production commits. Owner reviews/merges into mvp-complete under the standing no-agent-merge rule. Then, before another production build, set the Vercel production branch and Railway source branch to mvp-complete. Vercel root must be frontend (or use the equivalent root config), Railway root backend. Both repository Railway configs now use /api/health. Root and frontend Vercel API/uploads/socket rewrites now agree on the existing production backend. The build guard rejects production Vercel builds from other branches; local/preview builds are unaffected. Those dashboard settings have NOT been changed while the remote target remains old.

Provision a separate staging backend before authenticated preview or real-device tests: the existing Vercel rewrite config targets production, and fixture tests deliberately block external requests. Do not exercise synthetic users or provider sandbox callbacks against the production database.

## Existing PR coordination

- Match/map290 and messaging291–293 are already retained in production ancestry.
- Manual-invoice286 overlaps entitlement grants, active subscriptions and migration067: do not blindly combine with Verotel.
- Billing-copy287 overlaps Premium/Terms: review final payment availability copy after selecting invoice/provider scope.
- Brand288 must retain the shared media/map fixes when ported.
- Age273 is older repair context; optional-age Terms289 conflicts with mandatory-age behavior. Neither was auto-merged or retargeted.

Activation blockers: separate Age Estimation provider configuration/hosted validation, merchant sandbox contract validation, legacy entitlement reconciliation if invoice/promo paths are used alongside billing, real-device/PWA evidence, owner-reviewed branch reconciliation and deployment-setting cutover. No production migration or deployment is included in this work.

## Post-login preview failure follow-up

The release preview's account-status request is routed to the older production backend, where `/adult-assurance/account` falls through to a session-ID route and returns `400 invalid_session`. The public required-status response also lacks the new availability contract. Completing password and second-factor authentication does not satisfy the separate age gate.

The recovery screen now distinguishes loading, connection failure, provider unavailability and an available hosted flow; it displays one status, provides retry/sign-out, and rejects malformed success responses. Ten focused recovery/access tests and the frontend build passed. This UX fix does not activate the provider.

The existing Railway staging service was inspected: it follows main and has no separate Age Estimation settings. Do not blindly repoint the preview or enable fixtures to grant access. Restore the flow by validating an isolated staging database, deploying the matching backend/migrations there, provisioning the approved separate age integration, and then changing preview API/media/socket routing together. Test a new isolated session through second factor and the hosted age decision.

Production main advanced by two further commits after the original reconciliation snapshot (#294 and #296). They remain outside this draft and need preservation at the final owner-reviewed cutover; no merge or history rewrite was attempted in this follow-up.
