# MR3FREE — MenRush launch ad campaign promo

Quiet ops note. No marketing blast on public face. Al P0 BLOCKING launch ad.

**`MR3FREE` is the MenRush launch ad campaign code** — grants 3 months of Premium free, unlocked from day one.

Promoter (docs only): **Bronze Apps UK Limited t/a MenRush**.

## Legal — LOCKED

| Rule | Detail |
| --- | --- |
| Code | `MR3FREE` (also accept `mr3free`). Case does not matter. No spaces (`MR 3FREE` rejected). |
| Campaign name | `MenRush launch` (stored in `shared_promo_redemptions`). |
| Live from | **17 September 2026** (Europe/London). |
| Claim-by | **5 October 2026 Europe/London end of day inclusive** → `2026-10-05T22:59:59Z` (BST that day). |
| Post-cutoff | Signups after 5 Oct with this code get nothing (code expired). |
| Stacking vs Pride / BSF26 | **No stack.** Reject if any Pride or BSF26 path exists. |
| vs 30-day waitlist gift | **Replaces** Terms 7.2 waitlist gift. Not added on top. |
| Beta promises | **Does not cancel 12-month beta promises.** Existing longer `premium_until` is preserved. |
| Existing Premium | **Does not wipe existing Premium.** Always-premium owners (`BOA90`, etc.) and higher `premium_until` preserved. |
| Day one unlock | Pulse, discovery, and chat unlocked immediately from day of registration (`premium_starts_at` is set to registration date in Europe/London). |
| Double-claim | Rejected (`shared_promo_redemptions` unique on `email_hash` + `user_id` per campaign). |
| 18+ | Adult-assurance age-gate still applies at register (#97). |
| One account | One use per account / email. |

Legal face: Terms **§7.9** (MenRush launch promotional offer). §7.7 and §7.8 note MR3FREE cannot be combined.

## Clock & Entitlement Window

| Redeem (Europe/London calendar day) | Premium starts | Premium duration |
| --- | --- | --- |
| 17 Sep 2026 through 5 Oct 2026 | **That calendar day** London (day one unlocked) | **3 calendar months** |

Implemented via `mr3FreePremiumWindow` / `applyMr3FreePremiumGrant`.

## What MR3FREE does at register

1. Validate at register (`validateSharedMr3Free`)
2. Insert `shared_promo_redemptions` with `campaign = 'MenRush launch'`
3. Apply Premium via `applyMr3FreePremiumGrant` → `mr3FreePremiumWindow`
4. Skip `grantWaitlistGift` (replaces waitlist gift)
5. Preserve existing 12-month beta promises or lifetime Premium if present

## Smoke-test / QA

1. Register with `?promo=MR3FREE` (or type `MR3FREE` / `mr3free`) on a fresh 18+ email.
2. Confirm Premium: `is_premium: true`, `premium_starts_at` <= now, `premium_until` = 3 months. Confirm no stacked 30-day gift.
3. Negatives: double-claim; Pride path + MR3FREE; BSF26 + MR3FREE; space variants `MR 3FREE`; after claim-by (after 5 Oct); referral field with `MR3FREE`.

## Code map

- `mr3FreePremiumWindow` / `applyMr3FreePremiumGrant` / `validateSharedMr3Free` / `redeemSharedMr3Free` — `backend/src/services/promo.service.ts`
- Register branch — `backend/src/services/auth.service.ts`
- Referral classification — `backend/src/services/referral.service.ts`
- Migration — `database/migrations/064_mr3free_launch_promo.sql` and `backend/database/migrations/064_mr3free_launch_promo.sql`
- Terms §7.9 — `frontend/src/pages/Terms.tsx`
- Checks: `npm run test:mr3free` from `backend/`
