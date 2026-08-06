# MenRush 2.0 — Product Vision

**Status:** Guiding vision, approved 2026-08-06. Source of truth for all future Discover, Pulse, Events, Messaging, Premium, and platform-quality work. Every related issue/PR should reference this document; keep it updated as phases land.

**Governing rule:** unless explicitly stated otherwise, preserve existing functionality while improving UX. Do not remove features to simplify the interface. Follow `docs/AI_TEAM.md` for delivery process (issues → design review where required → scoped PRs → explicit human approval to merge/deploy).

## Final product vision

MenRush should feel like opening a live city. Users immediately understand:
- Who's nearby?
- What's happening?
- Where should I go?

Everything starts from one beautiful, fast, intelligent map.

## Release strategy

Do not build this in one PR. Four phases, each independently shippable:

| Phase | Scope |
|---|---|
| **1** | Discovery 2.0, Themes, Notifications, Calls fix (P0) |
| **2** | Messaging 2.0, Events, Referral, Feedback |
| **3** | Premium improvements, Beta dashboard, Advanced filters |
| **4** | AI features, Venue partnerships, Travel mode, Smart discovery |

## Section index

1. Discovery 2.0 (highest priority) — one map, layered: People, Hot Spots now; Pulse, Events, Venues later
2. Pulse — logo-icon FAB replacing the text button; live activity layer; temporary posts, no followers/likes/timeline
3. Events — map + calendar + list; save/remind/directions/share; future partner-venue submissions
4. Discovery filters — availability, hosting, purpose, distance, online, verified, Adult Assurance, Premium, age, interests, saved searches (Premium)
5. Messaging 2.0 — keep text/images/video calls; add voice notes, video notes (Premium), video attachments, voice calls; improve typing/read receipts/previews/gallery
6. Premium — £6.99/mo, £60/yr; all Beta users get Premium, single one-time notice only, never repeat-upsell during Beta
7. Notifications — badge-only on launch, no auto-open inbox; tap opens, opening marks read, read items drop from unread list; mark-all-read, delete, settings
8. Calls — **P0**: remote video renders black, both participants only see themselves; investigate signalling/ICE/TURN-STUN/stream attach/renderer/permissions/lifecycle; add voice calls + a visible video-call button
9. PWA — promote install (Sniffies/Google Maps pattern), guide through Add to Home Screen + desktop install, remember dismissal
10. Trusted devices — respect "trust this device", stop repeat 2FA prompts; still require re-auth after password change/manual revoke/long inactivity/security event
11. Settings review — full audit against the expected account-management surface (privacy, security, notifications, discovery, blocked users, data export, delete account, sessions, devices, language, theme, accessibility, location, premium, verification, support, legal, beta, referral, internal diagnostics)
12. Feedback — bug report/suggestion/feature request/rating, screenshot + device/app/browser info, automatic logs with consent
13. Referral — invite/earn/track UX, prepared ahead of activation
14. Help centre — review support/FAQ/privacy/terms/community guidelines/safety/technical support/contact/legal/accessibility docs for wording + consistency
15. Themes — complete light + dark, remove mixed components, accessibility contrast
16. Mobile parity — every desktop feature exists on mobile unless there's a strong UX reason not to
17. Accessibility — keyboard, screen readers, contrast, touch targets, animations/reduced motion, focus order
18. Performance — loading time, map lag, scroll lag, battery/memory/image size, caching, offline assets
19. Moderation & safety — preserve Adult Assurance, reporting, blocking, muting, location privacy, exact-location protection; Premium never bypasses safety
20. Discovery bottom sheet — every map interaction uses a modern, swipe-to-dismiss bottom sheet; never leave the map unnecessarily
21. Floating community button — logo-icon FAB with quick-post actions (Hosting now / Looking now / Cruising / Drinks / Travelling / Going to an event / Open to chat / Custom)
22. Chat improvements — pinned chats, unread filters, media gallery, search, reactions (future), scheduled messages (future), voice/video notes, video attachments
23. Beta dashboard — Beta-only: latest updates, known issues, roadmap, feedback, idea voting, referral status, Premium Beta notice
24. Brainstorming / future roadmap (not MVP blockers) — Travel Mode, Venue Verification, Live Venue Occupancy, AI Discovery Assistant, Smart Notifications, Nearby Icebreakers, Private Trip Planner, Premium Collections, Anonymous Activity Heat Map, Safety Check-in, Event RSVP, Club & Venue Partnerships, Seasonal Themes, Creator & Ambassador Programme
25. Status — always-visible, one-tap, profile + map, auto-expiring where appropriate, filterable discovery signal; complements Pulse rather than replacing it (see below)

## "Tonight" Mode

A toggle on the Discover map. When enabled, temporarily prioritises: people looking now, active Hot Spots, live Pulse posts, tonight's events, open venues, users currently hosting. Reframes the app from "who exists nearby" to "what can I do in the next few hours?" — tracked as a Phase 2+ candidate once Pulse/Events layers exist to prioritise.

## Status (§25)

Not Pulse. Not Profile. Just Status — a lightweight, always-on discovery signal, distinct from and complementary to Pulse:

| | Status | Pulse |
|---|---|---|
| Visibility | Always visible | Time-limited post |
| Effort | One tap | Writing a short update |
| Where shown | Profile + map | Map/feed only |
| Expiry | Automatic where appropriate | Always expires |
| Filterable | Yes | Yes |

Examples: 🟢 Available now · 🏠 Hosting · 🚗 Travelling · 🍺 Drinks · ❤️ Dating · 🔥 Looking now · 😴 Busy · ⛔ Do not disturb.

Rationale (product owner's own framing): asking users to constantly write Pulse posts is friction; Status is the near-zero-effort complement that still gives the map a useful discovery signal. The two coexist — Status is the "am I even open to this" baseline, Pulse is the richer "here's specifically what I'm doing" layer on top.

Design questions to resolve before scoping (mirrors §2 Pulse's design-child-issue pattern given this also touches profile display, the map, and filters):
- Data model: single `status` enum + optional `status_expires_at` on `profiles`, or does this share infrastructure with Pulse/Community (§54 epic)?
- Does setting a Status ever imply a Pulse post (or vice versa), or are they fully independent user actions?
- Expiry rules per status (e.g. does "Do not disturb" expire automatically at all, vs "Looking now" auto-expiring after N hours)?
- Map representation: badge on the existing person marker (`MapMarker.tsx`), vs. a separate visual treatment?
- Filter integration: extends §4's existing filter categories (`discoveryFilters.ts`) or is a new filter dimension?

## Delivery ledger

Cross-references this vision to actual GitHub state. Update as issues/PRs land.

| Section | Status | Tracking |
|---|---|---|
| 1. Discovery 2.0 — People/Hot Spots layers, in-map sheet, nav tab removed | ✅ Shipped | #67 (closed), PR #70 |
| 1. Discovery 2.0 — Pulse/Events/Venues as map layers | Not started | Depends on §2/§3 below |
| 2. Pulse — replaces "Live Profile List" as Community feed | Scoping | Epic #54, design child issues #57–#63 |
| 2. Pulse — logo-icon FAB (replacing text button) | Not started | New issue needed |
| 3. Events — map/calendar/list, save/remind/directions/share | Not started | New issue needed (Events currently exists as a basic rail + standalone page only) |
| 4. Discovery filters — current filter set exists; full expansion (availability/hosting/purpose/saved searches) | Partial | New issue needed |
| 5. Messaging 2.0 — voice/video notes, voice calls, gallery | Not started | New issue needed |
| 6. Premium — pricing, single Beta notice | Not started | New issue needed |
| 7. Notifications — toast leak fix | In review | #68, PR #69 (open, not merged) |
| 7. Notifications — badge-only redesign, mark-all-read, delete | In progress | #74 |
| 8. Calls — remote video black / signalling investigation | **In progress — P0. Real ICE-gathering test (no mocks) confirms 0 relay candidates ever produced against the current TURN config, and 0 candidates of any kind with relay forced — strong evidence, one real-world validation step (chrome://webrtc-internals on two real networks) recommended before purchasing a paid TURN provider** | #73, PR #75 (diagnostic logging only, draft) |
| 8. Calls — camera stays on after call ends | Tracked separately | #34 |
| 25. Status — always-visible one-tap discovery signal, complements Pulse | Not started | New issue needed once design questions above are resolved |
| 9. PWA install promotion | Not started | New issue needed |
| 10. Trusted devices | Not started | New issue needed |
| 11. Settings review | Not started | New issue needed |
| 12. Feedback system | Not started | New issue needed |
| 13. Referral UX (prep only) | Scoped, not built | #37–#40 (referral attribution/sharing/qualification/fraud) |
| 14. Help centre review | Not started | New issue needed |
| 15. Themes — light theme completeness | ✅ Shipped | #55 (closed), PR #64 |
| 16. Mobile parity — nav parity | ✅ Shipped | #52 (closed), PR #53 |
| 19. Moderation & safety — Adult Assurance enforcement | In progress | #50 |
| 19. Moderation & safety — security/privacy readiness review | Not started | #36 |
| 20. Discovery bottom sheet everywhere | Partial | Hot Spot sheet shipped (PR #70); People sheet (ProfileDrawer) predates this doc, already a sheet |
| — | CI-only test flakiness on `/discover` (blocking clean signal on Discovery work) | Open | #65 (reopened), #71 |

## Working rules for this document

- New scope discovered while implementing any section gets its own issue, linked back here — not silently expanded into an existing PR.
- No implementation branch opens for a section marked "Scoping" until its design child issues are reviewed (mirrors #54's existing rule).
- Phase order in the ledger above is the default; P0 items (Calls) may jump the queue by explicit instruction.
