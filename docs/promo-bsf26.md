# BSF26 — BearScotsFest 2026 only

Quiet ops note. No marketing face. Al P0 / Legal soft glance.

**`BSF26` is BearScotsFest 2026 ONLY** — not a general-purpose promo code.

Promoter (docs only): **Bronze Apps UK Limited t/a MenRush**.

## Out of scope (do not invent here)

Rugby club codes are **separate later work**: one code per club = club name Title Case with spaces; same 3-month Premium stack rules. Do **not** add rugby codes in this PR.

## Legal soft glance — LOCKED

| Rule | Detail |
| --- | --- |
| Code | `BSF26` exact (trim + uppercase). No `BSF 26` / `BSF-26`. BearScotsFest 2026 only. |
| Claim-by | **5 October 2026 Europe/London end of day inclusive** → `2026-10-05T22:59:59Z` (BST that day) |
| Stacking vs Pride | **No stack.** Reject if any Pride path exists. |
| vs 30-day gift | **Replaces** Terms 7.2 waitlist gift (same as Pride). Not added on top. |
| Double-claim | Rejected (`shared_promo_redemptions` unique on email_hash + user_id per campaign) |
| 18+ | Adult-assurance age-gate still applies at register (**#97**) |
| One account | One per person / email |

Legal face: Terms **§7.8** (names BearScotsFest 2026). Pride §7.7 notes BSF26 cannot be combined.

## CLOCK OPEN — pending Al lock (Product HOLD merge)

Al has **not** locked when the 3 months start. Do not invent Al's choice.

| Mode | Meaning | Config value |
| --- | --- | --- |
| Option A | Always from MenRush launch (1 Oct / `MENRUSH_LAUNCH_AT`) | `from_launch` |
| Option B | Always from redeem day | `from_redeem` |
| Pride hybrid (interim) | Before launch → launch; on/after launch → redeem | `pride_mirror` |

**Interim default in code: `pride_mirror`** (`BSF26_PREMIUM_START_MODE` in `promo.service.ts`).

Why: Pride's start rule is clear in `pridePremiumWindow`. Legal offered A vs B; until Al locks, we default to the Pride hybrid and keep A/B one-line flips. This is **not** Al's locked choice.

After Al locks: set `BSF26_PREMIUM_START_MODE` to `from_launch` or `from_redeem`, update Terms §7.8, re-run `npm run test:bsf26`.

## What Pride did (reuse / separation)

Pride public code `PRIDE 3MONTH FREE`:

1. Validate at register
2. Insert `shared_promo_redemptions`
3. Apply Premium via `applyPridePremiumGrant` → `pridePremiumWindow`
4. Skip `grantWaitlistGift`

BSF26 reuses redemption table + grant shape, but applies via **`applyBsf26PremiumGrant` → `bsf26PremiumWindow(mode)`** so the clock can flip without touching Pride.

## Smoke-test (BOA90 / owner account path)

Product tests on BOA90 before wide claim. After deploy:

1. Soft-refresh BOA90 app / staging.
2. Register with `?promo=BSF26` (or type `BSF26`) on a **fresh** 18+ email. Complete adult assurance if required (#97).
3. Confirm Premium: `premium_starts_at` / `premium_until` match **current** `BSF26_PREMIUM_START_MODE` (interim = Pride hybrid). Confirm **no** stacked 30-day gift.
4. Negatives: double-claim; Pride path + BSF26; `BSF 26` / `BSF-26`; after claim-by; referral field with `BSF26`.

## Code map

- `BSF26_PREMIUM_START_MODE` / `bsf26PremiumWindow` / `applyBsf26PremiumGrant` — `backend/src/services/promo.service.ts`
- Register branch — `backend/src/services/auth.service.ts`
- Terms §7.8 — `frontend/src/pages/Terms.tsx`
- Checks: `npm run test:bsf26` from `backend/`
