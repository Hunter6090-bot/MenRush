# MenRush redesign 2026-10 — feature map (Step 0)

**Source of truth for IA:** Pete design `MENRUSH PHONE — 9 STATES` (6 Oct 2026) + Product defaults (Matches → Chat chip; Nearby grid → Map/Grid toggle; Cruise/Hotspots/Events/Community → Out; Pulse/nudges → pin sheet More if live; Ready to meet removed).

**Rule:** NOTHING may be dropped. Old routes redirect; features relocate, they do not 404.

**Tokens:** night `#0D0A06`, card `#1E1508`, copper `#C4832A`, cream `#F0E0C0`, online `#4ADE80`. Medallion only for brand (`/brand/medallion-transparent.png`) — never draw MENRUSH as type. Media lock: never rewrite user photos. Keep #314 circular pins + green online rim, #312 grid square rim, #315 brand placeholder (branch if unmerged), All = UK/IE no radius, Nearby radius.

---

## New 5-tab shell

| Tab | Route (canonical) | Icon + 1-word label | Replaces / absorbs |
|-----|-------------------|---------------------|--------------------|
| **Home (Map\|List toggle)** | `/discover` | **List** when map is home (grid icon); **Map** when list is home (pin icon) | Nearby map + grid; preference persisted (`map`\|`list`, default map). In-map phone Map/Grid toggle removed as duplicate. |
| **Chat** | `/conversations` | Chat (+ unread badge) | Messages; Matches page becomes filter chip All / Matches / Unread |
| **Rooms** | `/rooms` | Rooms | Video rooms (Premium gate unchanged) |
| **Out** | `/out` | Out | Cruise/Hot Spots, Events, Community (Stream), venue list chips All / Sauna / Bar / Event |
| **You** | `/profile` | You | Profile + Settings entry, Albums, Discretion, Quiet hours, 2FA, Merch/Brands links, Sign out |

Desktop sidebar mirrors the same five + Settings / Notifications where needed. Mobile "More" sheet removed once Events + Settings have homes (Out / You).

---

## Full inventory → new home

| Current feature / screen / action | Current route / surface | New home (5-tab) | Notes |
|-----------------------------------|-------------------------|------------------|-------|
| **Nearby grid** (3-up square photos, #312 rim) | `/discover` grid view | **Map** → Map/Grid toggle (bottom-right on map) | Default view becomes **map**; grid preserved |
| **Discover All** (UK+IE, no radius) | `/discover` radius All | **Map** → Radius pill → All | Keep #309 behaviour |
| **Nearby radius** | `/discover` radius pills | **Map** → top pill **Radius N mi** | Cycles / sheet; empty → Widen |
| **Map with pins** (#314 circular + green online) | `/discover` map | **Map** (home) | Cream rim; copper ring when selected |
| **Cluster (+N)** | map markers | **Map** | Keep existing overlap/cluster logic |
| **People / Cruise layer toggles** | map chrome | **Map** chrome below top pills (icon+short label) | Stacked under Radius/Filters/Search so all stay tappable at 390px |
| **Discretion / pin fuzz slider** | map chrome | **Map** (below top pills) + **You → Discretion** | Map slider stays live; never covered by top pills; Settings row links |
| **Map expand / hide / geolocate** | map BR controls | **Map** bottom-right control cluster | Design: bottom-right control |
| **Cruising search (spots)** | CruisingSearchBar/Sheet on Discover + HotSpots | **Map** Search (spots) + **Out** | Search pill opens profile+place search; Cruise search remains reachable |
| **Profile search (name or town/city)** (#310) | Layout header / ProfileSearchModal | **Map** top **Search** pill (+ header on desktop) | Same modal |
| **Filters** (age, status, interests, mood filters) | DiscoveryFilterPanel / MoreFiltersDrawer | **Map** top **Filters** sheet | Design sheet: Age slider, Visiting / Now / Photo only, Reset + Show; keep full filter set behind same sheet (no drop) |
| **Mood picker (set own mood)** | Discover mood strip | **Map** Filters sheet / You profile edit | Remove mood **text on cards** (cut); setter stays reachable |
| **NEW joiner badges on cards** | NearbyProfileGrid / ProfileCard | **Cut from cards** | Filter status "NEW" remains in Filters; badge not painted on tiles |
| **Ready to meet** | (removed Pete 3 Oct) | **Stay removed** | Do not restore |
| **Report / Block on cards / three-dots on sheet header** | ProfileDrawer ChatSafetyMenu corner; ConversationItem | **Pin sheet → More** only (Report, Block red, Cancel) | Never as flags on cards; More copy says menu (not "flag menu"); More avatar uses BrandAvatar onError fallback |
| **Match / Sent / Unmatch triad** | ProfileDrawer, Matches page, grid match CTA | **Pin sheet More** (Match/Unmatch) + **Chat** Matches chip + full `/matches` redirect | Match-state triad preserved |
| **Pulse (start/stop FAB)** | Discover PulseFab + desktop header | **Map** (FAB kept for discoverability) + **Pin sheet More** when peer pulsing (Pulse back → open own Pulse sheet) | Live: onPulseBack wired to requestOpenPulse |
| **Pulse nudge banner** | Discover | Soften / move to More or empty map copy | Do not delete API |
| **Hot Spots / Cruise list + map** | `/hot-spots` | **Out** (chips) + deep link `/hot-spots` → `/out?chip=…` | Route still works |
| **Cruise category chips** (saunas, bars, …) | HotSpots | **Out** chips All / Sauna / Bar / Event | Map Event chip to Events surface |
| **Events calendar + list** | `/events` | **Out** chip Event + `/events` redirect | Preserve nightlife calendar |
| **Community / newsfeed** | `/stream` | **Out** chip Community (or All section) + `/stream` redirect | Posts, @mentions, 24h expiry, edit/delete stay |
| **Venue claim / reviews / calendar modals** | HotSpots | **Out** (same modals) | Admin `/admin/venue-claims` unchanged |
| **Events rail on Discover** | Discover footer rail | **Map** optional thin rail OR **Out** | Prefer Out; keep rail if it does not clutter map-first |
| **Chat inbox** | `/conversations` | **Chat** | Search pill on list (min 44px); pinned Matches entry (icon + count) opens `/matches` |
| **Chat thread** | `/messages/:id` | **Chat** | Header avatar + name + Near·distance, More; Photo / Message / Send |
| **Group create** (feature-flagged) | ConversationList | **Chat** | Keep behind flag |
| **Withdraw location share** | Messaging | **Chat** thread | Unchanged |
| **Video / voice calls** | VideoCallModal | **Chat** / Rooms | FEATURES.videoCalls |
| **Matches list + received likes** | `/matches` | **Chat** pinned Matches row (always visible) + filter chip Matches + `/matches` page | No 6th bottom tab; full triad UI reachable |
| **Video rooms list + in-room** | `/rooms`, `/rooms/:id` | **Rooms** | Premium gate; temp name / camera / mic / temp photo / Join |
| **Room pre-join** | RoomsRoute | **Rooms** | Match design state 9 |
| **Albums (mine + grants)** | `/albums`, Profile | **You → Albums** + pin sheet **Album** button | Album navigates to profile `#albums` (section id + hash scroll) |
| **Profile edit / setup** | `/profile`, `/profile/setup` | **You → Edit** | Unchanged fields |
| **Profile view other user** | `/profile/:id` | **Pin sheet → Profile link** + full page | Unchanged |
| **ID verified tick / Veriff Get verified** | Profile, Trust | **You** badge + Settings/Profile Veriff entry | Never gates ordinary access |
| **Online green** | pins, avatars | **Map pins + Chat avatars** | Keep #314 / green rim |
| **Brand placeholder avatar** (#315) | FadedBrandFace | All empty faces | If #315 unmerged, note only — do not conflict |
| **Notifications / Alerts** | `/notifications` + header bell | **You** or header icon (keep header) | Badge preserved |
| **Push / quiet hours / notification settings** | Settings NotificationSettings | **You → Quiet hours / Settings** | |
| **2FA / trusted devices** | Settings TwoFactorSettings | **You → 2FA** | |
| **Premium / billing / promo codes** | `/premium`, Profile, Settings | **You → Settings / Premium** | Verotel; beta gift copy |
| **Referrals** | Profile ReferralCard | **You** | |
| **Follow @menrushsocial** (IG + Bluesky) | Settings | **You → Settings** secondary | |
| **Theme toggle** | Layout header | Keep header / You Settings Appearance | |
| **Sign out** | Layout + Profile + Settings | **You** footer | Confirm dialog |
| **Delete account / reports history** | Settings | **You → Settings** | |
| **Ghost / presence strip** | Layout strips | Keep under Map shell | |
| **First-run 18+ gate** | Register DOB + AdultAssuranceFlow | Dedicated gate screen matching design (medallion, I'm 18+ / Leave) on first open if not assured | Signup path stays; add shell gate if missing |
| **Login / Register / forgot / reset / check-email** | public routes | Unchanged | PublicAuthShell medallion |
| **Legal: Terms, Privacy, Cookies, Safety, Guidelines, Help, Contact** | public | Unchanged; linked from You/Settings | |
| **Pride / Coming soon / Get the app / Beta** | public | Unchanged | |
| **Install PWA prompt** | InstallPrompt | Unchanged | |
| **Admin venue claims** | `/admin/venue-claims` | Unchanged (not in tab bar) | |
| **Dev previews** | `/dev/*` | Unchanged | |

---

## Redirect matrix (no 404s)

| Old path | Behaviour |
|----------|-----------|
| `/discover`, `/discovery` | Map tab (canonical) |
| `/matches` | Remains rendered **or** redirects to `/conversations?filter=matches` with list still available — prefer keep page + Chat chip deep-link |
| `/stream` | Redirect → `/out?section=community` (or render Stream inside Out) |
| `/events` | Redirect → `/out?section=event` (or embed) |
| `/hot-spots` | Redirect → `/out?section=cruise` (or embed) |
| `/settings` | Keep page; primary entry from **You** |
| `/notifications` | Keep; header + You |
| `/profile`, `/albums`, `/premium`, `/rooms` | Unchanged |

---

## Cuts (presentation only — capability kept elsewhere)

- 7 primary mobile destinations → **5 tabs** (Community, Matches, Events leave the tab row).
- **NEW** badges on profile cards/tiles.
- **Mood text** on cards.
- **Ready to meet** (already removed).
- **Report \| Block** as visible flags on cards (move to More).

---

## Soft P1 / deferred (must not block Step 1)

- Pixel-perfect Filters sheet vs full existing filter taxonomy (expose design trio first; full set in same sheet).
- Exact Out chip mapping for every HotSpot category slug.
- First-run medallion gate polish if AdultAssurance already covers signup.
- Desktop sidebar label rename Nearby → Map.
- Removing Discover EventsRail once Out is complete.

---

## Step 1 PR scope checklist

- [x] Feature map (this file)
- [x] 5-tab bar Home(Map|List) / Chat / Rooms / Out / You
- [ ] Redirects for old tab routes
- [ ] Map top pills Radius / Filters / Search + Map/Grid toggle
- [x] Pin sheet: photo, name+tick, age·distance, Now, Profile; Chat / Album (#albums) / More
- [x] More: Report, Block (red), Cancel + Match / Pulse back (wired) if live; BrandAvatar fallback
- [ ] Empty radius: Nobody in this radius + Widen to N mi
- [x] Map pills above Discretion/People/Cruise; Chat Matches entry + 44px chips; Out ≥14px; tokens + 44pt



## QC follow-ups (6 Oct 2026)

- Phone map (390px): Radius/Filters/Search pills sit above Discretion + People/Cruise so all remain fully visible and tappable.
- Chat tab: always-visible pinned Matches row (icon + count badge) opens `/matches`; All/Matches/Unread chips kept; chips + Search pill min 44px.
- Out: spot/event 11px copy raised to 14px; footer deep-links min-height 44px.
- Pin sheet More: BrandAvatar with brand-face onError; Report/Block copy refers to menu (not flags); Pulse back wired to live Pulse sheet; Album → profile `#albums`.
- HOLD unchanged: Rooms vs Video rooms label, Nearby default Map with List tab, Community icon.
