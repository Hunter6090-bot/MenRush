# Promo BSF26 (fest contact)

Quiet ops note. No marketing face. Al P0 for a fest contact.

## Rules (locked)

| Rule | Detail |
| --- | --- |
| Code | `BSF26` exact (trim + uppercase). No `BSF 26` / `BSF-26`. |
| Grant | 3 months Premium — **same clock as Pride** (`pridePremiumWindow` / `applyPridePremiumGrant`) |
| Window | Join/redeem from now through **end of 5 October 2026 UK** inclusive |
| Timezone | UK on that date is BST (UTC+1). Cutoff stored as `2026-10-05T22:59:59Z` (= 23:59:59 BST). |
| Stacking vs Pride | **Does not stack.** One 3-month promo path per email (Pride public / invite / personal **or** BSF26). |
| Stacking vs 30-day gift | **Same as Pride vs Terms 7.2:** BSF26 **replaces** the 30-day waitlist gift. Not added on top. |
| Eligibility | 18+, one account / email, exact code at register |

Legal face: Terms **§7.8**. Pride §7.7 notes BSF26 cannot be combined.

## What Pride did (and what we reused)

Pride public code `PRIDE 3MONTH FREE`:

1. Validate at register (`validateSharedPride`)
2. Insert `shared_promo_redemptions` (campaign + email_hash unique)
3. Apply Premium via `applyPridePremiumGrant` → `premium_starts_at` / `premium_until` from `pridePremiumWindow` (launch if before open; else redeem date + 3 calendar months)
4. Skip `grantWaitlistGift` when a Pride path applied

BSF26 reuses steps 2–4 with campaign `bsf26_public` and `redeemSharedBsf26`. Cross-checks Pride paths so the two cannot stack.

## Smoke-test (BOA90 / owner account path)

Product tests on BOA90 before wide claim. Suggested path after deploy:

1. Soft-refresh BOA90 app / staging.
2. Open register with `?promo=BSF26` (or type `BSF26` in the promo field). Quiet face — no landing marketing required.
3. Create a **fresh** 18+ test email (not an email that already redeemed Pride or BSF26).
4. Complete adult assurance if required on that environment.
5. After signup, check Premium: `is_premium`, `premium_starts_at`, `premium_until` ≈ 3 months from launch (or from redeem if after 1 Oct). Confirm **no** extra 30-day waitlist gift stacked.
6. Negative checks:
   - Same email + BSF26 again → already used / cannot stack
   - Email with Pride path + BSF26 → stack blocked
   - `BSF 26` / `BSF-26` → not valid (exact match)
   - After `2026-10-05T22:59:59Z` → expired message
7. Referral field with `BSF26` → rejected (use promo field)

Owner always-Premium accounts (BOA90) keep lifetime Premium; use a disposable test account for grant shape, or inspect `shared_promo_redemptions` for campaign `bsf26_public`.

## Code map

- `backend/src/services/promo.service.ts` — constants, validate/redeem
- `backend/src/services/auth.service.ts` — register branch (BSF26 before waitlist gift)
- `backend/src/services/referral.service.ts` — foreign-code reject
- `frontend/src/pages/Terms.tsx` — §7.8
- Checks: `npm run test:bsf26` from `backend/`
