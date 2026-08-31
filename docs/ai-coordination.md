# MenRush multi-agent coordination

Grok, Cursor, and Claude Code all touch this repo. **Do not duplicate work.**
Before any commit or push, run the checks below and update the work ledger.

## Pre-commit checklist (required)

Run from repo root (`/Users/alzain/em`):

```bash
git fetch origin
git status -sb
git log origin/mvp-complete --oneline -10
git diff origin/mvp-complete --stat
```

Then for the feature you are about to commit:

1. **Search remote history** — is it already merged?
   ```bash
   git log origin/mvp-complete --oneline --grep="<keyword>" -i
   git show origin/mvp-complete:<path/to/file> 2>&1 | head -3
   ```
2. **Search other branches** — Cursor/Claude often use feature branches:
   ```bash
   git branch -a | rg -i "feat|fix|claude|cursor"
   git log origin/main --oneline -5
   ```
3. **Diff only your scope** — stage narrowly; never `git add -A` without review.
4. **Security audit** (before push): inspect `frontend/src/api/client.ts` and
   `backend/src/server.ts` for unexplained outbound HTTP.
5. **Update this ledger** — add a row when you commit; mark superseded rows.

If remote already has the change, **stop**. Do not recommit or force-push.

## Commit message convention

Include the agent that did the work so history is searchable:

```
feat(discover): mobile grid layout (grok)
fix(auth): case-insensitive email (cursor)
style(icons): heritage set (claude)
```

## Work ledger

| Area | Remote (`origin/mvp-complete`) | Local only (uncommitted) | Owner / notes |
| --- | --- | --- | --- |
| Community post comments (text replies on `/stream`) | this branch `cursor/five-features-community-discreet-1e25` | — | Cursor cloud — `community_post_comments` 043; GET/POST `/api/community/posts/:id/comments`; ≤280; free; blocks respected; no media. Do not restore MAP\|COMMUNITY (#165). |
| **FLAGGED — Community nav (needs Product)** | open | — | Five-features brief: Discover `MAP\|COMMUNITY` + desktop list-under-map = Community feed. **Shipped #165:** Nearby is Grid↔Map only; Community is own nav at `/stream`. Code kept #165. Do not restore the toggle without an explicit Product call. |
| Merge `origin/main` into five-features (same-intent → main) | this branch `cursor/five-features-community-discreet-1e25` | — | Cursor cloud — took shipped main for Community API, Discreet (`DISCREET_MEDIA_BLUR` off), Safety `thread_id`, More filters, Nightlife 040. Dropped HEAD 039 combined, DiscreetMedia, always-on blur, `/users/sentinel`. Community placement left flagged (row above). |
| Nearby Grid-first + Community own nav (Brand / Zoul 31 Aug 2026) | PR `#165` draft `cursor/grid-three-up-phone-b1fe` | — | Cursor cloud — Grid↔Map only; kill MAP\|COMMUNITY; Community own icon `/stream` between Nearby+Chat; three-up phone; desktop panel; BrandMark only; do not merge until phone share; do not mix #163/#97–#99/#150 |
| Video rooms first-class chrome (Chat stays Chat; not nested in messages) | PR `cursor/video-rooms-chrome-entry-6abc` | — | Cursor cloud — chrome + entry only; RoomsHub own desktop surface; no #150 identity; held for Product logged-in preview; do not mix #165/#97–#99 |
| Cruise rename (Hot Spots face → Cruise; ship pins on Nearby) | PR `cursor/cruise-hotspots-rename-244a` | — | Cursor cloud — face only; `/hot-spots` API+route kept; check-in unchanged; no new tab; held for Product preview; do not mix #165/#150/#97–#99 |
| My Photos (public / view once / private / revoke viewers-only) | PR `#171` `cursor/my-photos-album-states-38f0` | — | Cursor cloud — four album states; revoke viewers-only never wipe; **media property lock**: existing photo_url/cover/album_photos stay; 041 backfill unlocked→public locked→private; DISCREET_MEDIA_BLUR stays off; do not mix #165/#150/Cruise; #97–#99 parked; hold merge until Product logged-in preview |
| Discovery age From–To selects (18–99; Age tab only) | PR `cursor/discovery-age-range-filter-9f19` | — | Cursor cloud — From/To `<select>` only; no presets; not Veriff/#97; do not merge #148/#165/#171; owner deploys pack |
| Android Chrome one-tap Install (persist beforeinstallprompt) | PR `cursor/android-one-tap-install-b87f` | — | Cursor cloud — module store + early capture; Android Install app / Install MenRush; Safari Show me how; do not mix Grid #165 / Community / My Photos #171 / rooms #150/#169 / Cruise #170 / age #159 / icons / #97–#99 |
| Nav icons: Settings gear + Rooms camera/people (kill Doric columns) | PR `cursor/nav-settings-rooms-icons-d7d9` | — | Cursor cloud — IconSettings=6-tooth cog; IconRooms=camera+2 people; preview HTML dupes; do not mix #150/#165/#170/#171/#169 |
| Landing header BrandMark top-left (ComingSoon) | PR `cursor/landing-header-brandmark-35ee` | — | Cursor cloud — sm BrandMark → `/` left; Sign in right; hero mark kept; overline LIVE NOW. UK BETA OPEN; do not mix #165/#163/#97–#99 |
| P0 Go live / Discover bounce (location ≠ incomplete profile) | PR `cursor/fix-go-live-discovery-bounce-d9b8` | — | Cursor cloud — honest live ticks; RequireProfileSetup never redirects for GPS; ActivationBanner Settings not Finish profile; /me lat/lng coerce; Safari how-to; do not touch #97–#99 / #158 / #160 / #162 / held PRs |
| Landing hero overline period (not dash) | PR `#167` on main | — | Cursor cloud — LIVE NOW. UK BETA OPEN; do not mix #165 |
| PWA Get the App: apostrophe leak + desktop banner + Done→/login | PR `cursor/fix-pwa-install-prompt-6d80` | — | Cursor cloud — JSX `\u2019`→real `'`; InstallPrompt phone-only via `isPhoneDevice`; Done→/login; do not touch #97–#99 / #158 / #160 / landing copy |
| P0 mobile web page weight (phones slow; desktop OK) | PR `#160` `cursor/mobile-web-page-weight-b5a8` | Matches progressive paint + Chat 3–4s control e2e | Cursor cloud — Nearby/Matches iPhone; Chat list floor; `/api/media/display`; no host move; #97–#99 parked |
| P0 beta: chat reply/send + blank profile + crash + push-tap + open-thread media + notif tray route | PR `#158` `cursor/p0-chat-profile-beta-0e36` | — | Cursor cloud — merged main (UK beta landing kept); navigate-first tap-to-chat; open-thread poll; SW tag recovery; owner asked deploy; #97–#99 parked; timings #160 |
| UK beta-open landing hero (LIVE NOW — Sign up free → /register) | PR `#161` on main | — | Cursor cloud — hero only; remove Oct date + email waitlist; logo/headline/bg unchanged; do not touch #158/#160/#150/#97–#99 / Social Studio / pride |
| Mutual profile: Pass · Open chat · Unmatch (drop duplicate Message) | PR `cursor/mutual-profile-unmatch-fd7a` | — | Cursor cloud — DELETE /users/like/:id removes both like dirs; ProfileView only; do not touch #97–#99 / rooms / public copy |
| Profile tag pick-one / pick-several UX cue | PR `cursor/profile-tag-pick-cue-4040` | — | Cursor cloud — cue only under each tag subsection; selection rules unchanged; do not touch #97–#99 |
| Discover Map\|Community parity + phone pinch zoom | PR `cursor/discover-map-community-parity-2402` | — | Cursor cloud — desktop under-map = Nearby (not Community); shared MAP\|COMMUNITY tabs; phone map pinch via touch-action/overflow + disableRotation; do not touch #97–#99 |
| Pride exclude drip + wave-2; invite email copy (30-day gift, no em dashes) | PR `cursor/pride-exclude-drip-wave2-a4e8` | — | Cursor cloud — source=pride out of drip/wave-2; Pride email bargain reword; do not touch /pride face or #97–#99 |
| Video note send MIME (MediaRecorder codecs→text/plain reject) | PR on main | — | Cursor cloud — client strips base MIME; API names mime reject; desktop webm + iPhone mp4 |
| Community Space (replace Live Profile List) | PR `#134` on main | — | Cursor cloud — item 1/5; text posts ≤280; MAP\|COMMUNITY toggle; desktop list = feed |
| Discreet Mode media blur (item 2/5; Ghost untouched) | PR `#136` on main | — | Cursor cloud — `media_clear` + CSS blur; `DISCREET_MEDIA_BLUR` opt-in (default off); no public copy |
| Safety & Trust (Identity Checked badge + panic report) | PR `#137` on main | — | Cursor cloud — badge prominence + one-tap report w/ thread_id → SENTINEL |
| Discovery More filters drawer (vibe/scene/connection) | PR `#138` on main | — | Cursor cloud — item 4 of 5 only |
| Nightlife venue check-in (Events → Hot Spot pin, 4h TTL) | PR `#139` on main | — | Cursor cloud — item 5; migration renumbered 040 after #134 took 039 |
| Browser smoke e2e gate (4173 base URL + live public assertions) | PR `cursor/browser-smoke-public-assertions-c3c3` | — | Cursor cloud — Oct 1 UK launch gate; no /pride or product copy |
| Verified profiles landing copy (replace Verified bodies) | PR `#120` `cursor/verified-profiles-landing-51f5` | — | Cursor cloud — ComingSoon hero + design-lock e2e + marketing rule; merged |
| Pride parade photo wash on /pride (claim-only; no printed-code CTA on face) | branch `cursor/pride-parade-bg-26c8` | — | Cursor cloud — Owner 22 Aug 2026; full-bleed 21-pride-parade-flags + night/copper wash |
| Pride claim-only face (Terms 7.7 grant rules; no Offer conditions; no Brighton on /pride) | PR `#129` on main | — | Cursor cloud — face = claim + Terms apply line; grant rules in Terms 7.7 |
| Pride short face copy (/pride claim-only hero) | superseded by Terms-face lock | — | Superseded — do not ship numbered Offer conditions on face |
| Pride redeem-only restore (printed PRIDE 3MONTH FREE at register by 5 Sep; quiet /pride note) | PR `#126` on main | — | Cursor cloud — Legal 21 Aug 2026; Claim Pride CTA only; no Path 2 card; personal codes to 31 Oct (do not name Brighton on /pride) |
| Pride one path only (kill public PRIDE 3MONTH FREE) | superseded | — | Superseded by redeem-only restore — public code works at register again through 5 Sep |
| Pride-flagged waitlist invite (one code = beta + booked 3mo Premium; 21–31 Aug /pride) | PR `#121` on main | claim path + public redeem | Cursor cloud — Claim Pride email invite; printed public redeem restored |
| Pride sole public offer (`/pride`; closed `/brightonpride` → redirect) | PR `#118` (folds #119) | claim + quiet public redeem | Cursor cloud — /pride Claim CTA; printed public redeem at register; Brighton grandfather |
| Kill homepage fade + rooms skeleton blink | PR `cursor/kill-fidgety-motion-283d` | — | Cursor cloud — remove `mr-launch-fade`; RoomList refresh in place |
| Oct 1 2026 social calendar seed (`oct1-2026`) | PR `#112` `cursor/social-oct1-2026-calendar-5921` | — | Cursor cloud — docs + idempotent seed; draft only; do not auto-publish; merged |
| Social Studio visual workspace (logo default + Week 1 = 21–27 Aug) | PR `#117` `cursor/social-studio-visual-workspace-84c2` | — | Cursor cloud — default logo preview; Day 1 = 21 Aug opening copy; no Pride / #97–#99 |
| Local Social Studio (Connections + week Approve) | PR `cursor/social-studio-local-0674` | — | Cursor cloud — `social-studio/`; keys in `.data/` only; no Railway outbound social; do not touch #97–#99 |
| Social Studio visual workspace + owner photo → public https | PR `cursor/social-studio-owner-photo-https-266f` | — | Cursor cloud — auto-host owner uploads for Graph; never logo as post image; skip if no owner photo; do not touch #97–#99 |
| UK launch homepage (ComingSoon 1 Oct 2026) | PR `#111` `cursor/uk-launch-homepage-527c` | — | Cursor cloud — dated UK launch page; waitlist/invite/sign-in kept |
| Discover Sign out confirm + START PULSE sheet wiring + radius label sync | PR `cursor/fix-discover-signout-pulse-55cd` | — | Cursor cloud — do not redo; confirm before logout; Pulse never silent no-op |
| Dead pressables (Events Tickets, RoomChat attach/emoji, search label) | PR `#104` `cursor/fix-dead-pressables-8f37` | — | Cursor cloud — draft; do not merge yet |
| Chat camera Picture|Video chooser | PR branch `cursor/chat-camera-picture-video-chooser-c19f` | — | Cursor cloud — camera tap → chooser → live capture; no hold-for-video |
| Incoming likes ungated on Matches (no MenRush+ lock) | PR `cursor/incoming-likes-no-paywall-b610` (#103) | GET /likes/received; Matches Liked you section; e2e | Cursor cloud — do not reintroduce PremiumGate on likes |
| Login toast dump / badge-only (#74 leftover) | PR `cursor/fix-notification-toast-backfill-7723` | — | Cursor cloud — `setFromServer` never toasts; live upsert after sync may |
| Full profile settings (DOB, name, stats, delete) | PR branch `cursor/complete-profile-settings-6691` | — | Cursor cloud — editable post-signup parity |
| Settings tidy + change password | pending push | Account section, POST /auth/change-password, grouped Settings UI | Grok |
| Mutual chat gate + Match coach (likes dead-end fix) | `246aec0` — pushed + Vercel prod | Chat only on mutual; Matched vs Open chat; first-Match coach | Grok CEO cycle 18 |
| Sent likes hydrate + empty density teaser + real photo setup | `2593b09` — pushed + Vercel + Railway | GET /likes/sent; beyond-radius count; ProfileSetup demotes generic | Grok CEO cycle 17 |
| Profile depth strip + Settings location first + Stream Match hydrate | `c58a6a6` — pushed + Vercel prod | ProfileDepthStrip; Settings pin Off first; ProfileCard/Stream Match state + API errors | Grok CEO cycle 16 |
| Real photo rank + generic upgrade banner + liked hydrate | `1d87118` — pushed + Vercel + Railway | Nearby ORDER BY real photo; ActivationBanner soft photo; Discover likedUsers from matches | Grok CEO cycle 15 |
| Grid Match CTA + like SecurityError + ops waitlist fix | `fdd3c43` — pushed + Vercel + Railway SUCCESS | — | Grok CEO cycle 14 |
| Login show-password + clearer errors | `261e5e9`, `c0ed4e1` — pushed | — | Grok — `/login` + landing |
| Password reset Zoho fallback | `261e5e9` — pushed | backend deploy pending on Railway | Grok — Railway not promoting new builds yet |
| Video call camera/layout/ringtone | `902440a` — pushed | — | Grok |
| UK locale miles display | `addb919` — pushed | — | Grok |
| Mobile discover/matches/hub | `1ae8323` — pushed | — | Grok |
| AI coordination runbook | `902846b` — pushed | — | Grok |
| ID verification gate pause + broadcast | `705494f` — pushed | — | Grok — do not redo |
| Miles radius dropdown / quick pills | `26fd490`, `a5d58a3` | `RadiusMilesSelect.tsx` further edits | Claude/Cursor on remote; local tweaks uncommitted |
| UK locale: display miles vs km by browser locale | — | `localeUnits.ts`, `useLocaleUnits.ts`, display overrides | Grok — not on remote |
| Mobile hub / Discover grid / Matches mobile | partial mobile fixes in `a93d8ab` | `MobileHubTabs.tsx`, large `Discover.tsx` / `Matches.tsx` diffs | Grok — not on remote |
| Desktop copper design migration | `2ec43b4` + follow-ups | some page tweaks | Claude/Cursor — largely on remote |
| 2FA (TOTP) | `b6b8f5b` — pushed | — | Grok — setup/enable/disable routes + Settings UI |
| Match live location sharing | `b6b8f5b` — pushed | — | Grok — map, chat card, toggle, socket broadcasts |
| Wave-2 waitlist invites (ops) | drip templates on remote | `send-wave-2-invites.ts` | Ops script; 40/41 already sent — do not bulk-resend without ledger check |
| Cursor workflow rules | `837e2ea` | `.cursor/rules/menrush-logo.mdc` (untracked) | Cursor |
| Claude heritage icons | `9b7644f` | — | Claude — done |
| Waitlist welcome / drip | `ebdbd7c`, `015f0ea` pause rules | `waitlist-ops-source-of-truth.md` edits | Ops — check Zoho + `waitlist_drip_sends` before sends |
| Discover mood strip + stale online cleanup + MoodBadge | cycle 2026-07-11 | Mood on Nearby; DB online=false after 20m idle; mood on cards | Grok CEO cycle 13 |
| Events location gate + presence heartbeat + onlineFresh | cycle 2026-07-11 | Events GPS gate; 8m location heartbeat; ops onlineFresh | Grok CEO cycle 12 |
| Fresh online presence + HotSpots gate + photo nudge | cycle 2026-07-11 | Online only if last_seen <20m; HotSpots location CTA; real-photo upgrade | Grok CEO cycle 11 |
| Looking-for on cards/drawer + ops metrics commit | cycle 2026-07-11 | Intent visible on map cards; ops-metrics + migrations 022/023 in git | Grok CEO cycle 10 |
| Pulse nudge + match→Pulse + notifications empty | cycle 2026-07-11 | Empty map Pulse prompt; match toast Start Pulse; alerts empty CTAs | Grok CEO cycle 9 |
| Global location strip + Settings pin + poll hygiene | cycle 2026-07-11 | App-wide location CTA; Settings enable; pause hidden polls; junk JWT clear | Grok CEO cycle 8 |
| Icebreakers + like feedback + inbox empty CTAs | cycle 2026-07-11 | Chat openers; Stream card like state; conversations empty multi-CTA | Grok CEO cycle 7 |
| Stream location + Matches empty + match toast | cycle 2026-07-11 | No London on Stream; multi-CTA matches empty; mutual match → chat | Grok CEO cycle 6 |
| Live location required + Hot Spots empty CTA + auth heal | cycle 2026-07-11 | Setup go-live needs GPS; empty density → Hot Spots; zombie token heal | Grok CEO cycle 5 |
| Bio minimum + Pulse empty CTA + beta invite UX | cycle 2026-07-11 | Discover min needs bio; Start Pulse on empty density; invite normalize/guard | Grok CEO cycle 4 |
| Session 401 fix + profile depth + ProfileView safety | cycle 2026-07-11 | Sync logout; require looking+tags before skip; report/block on full profile | Grok CEO cycle 3 |
| Location gate + profile safety + frontend deploy | cycle 2026-07-11 | No fake London pin; report/block on drawer; Vercel ship | Grok CEO cycle 2 |
| Ops health + density activation | `67e8517` — pushed + Railway SUCCESS | Prod backfill: 22 generic avatars → withPhoto 26/26 | Grok CEO cycle 2026-07-11 |

*Last audited: 2026-07-11 (Grok CEO cycle). Refresh `git fetch` + ledger before your next commit.*

## What each agent should read

| Agent | Config |
| --- | --- |
| Cursor | `.cursor/rules/menrush-workflow.mdc` (always on) |
| Claude Code | `CLAUDE.md` + this file |
| Grok | `docs/ai-coordination.md` + user standing instruction |

## Ops that are never duplicated via git

Email sends, Railway env toggles, DNS fixes, and manual ID approvals live outside
git. Before re-running a script (`notify:*`, `send-wave-*`, drip `--send-now`):

- Read `docs/waitlist-ops-source-of-truth.md`
- Query `waitlist_drip_sends` / campaign ledger for the template key
- Prefer `--dry-run` first