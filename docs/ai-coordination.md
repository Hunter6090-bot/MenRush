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