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
| Ops health + density activation | cycle 2026-07-11 (this commit) | `/api/health`, 401 session clear, default generic avatar on signup, Discover empty CTAs + location nudge | Grok CEO cycle |

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