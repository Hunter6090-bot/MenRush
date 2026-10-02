# Missing Verified ticks — evidence-based reconciliation

## Flags and eligibility

- `is_verified`, `verification_provider='veriff'`, `verification_status='verified'` and `verified_at` describe the optional identity badge. Profile, discovery and drawer render the server flag; they must not infer it from submission, photo, age flag, or provider-page completion alone.
- `verified_age_18_plus` and `age_assurance_status` concern mandatory adult assurance. Access additionally checks redeemed version 2 non-fixture evidence from the separate reviewed age/liveness integration. Identity badge repair does not grant these.

## Concrete defects

`veriffService.applyDecision` returned immediately when the stored session status was approved, so a genuine authenticated approval replay could not repair missing user flags. Recovery polling excluded approved sessions entirely. Both defects exist on inspected main and the previous draft. Rendering already consumes the appropriate backend flag; no speculative UI badge was added.

Fresh signed webhooks or authenticated decision polling can now repair missing badge fields on the exact current linked session. Approved decisions require numeric code 9001, and an unknown, superseded, declined, expired or abandoned session cannot be used to award a tick. Repeated delivery does not repeat the referral callback. Underage document evidence does not award a tick and can revoke an earlier approved badge. Re-polling rejects a response for a different session.

## Existing accounts: review before apply

Run `npm --prefix backend run verification:badge-inventory -- --dry-run` in an authorised environment with its database connection configured privately. It uses a read-only transaction, prints aggregate counts only and has no apply mode. Stored approved/9001 records with missing flags are recheck candidates, not automatic grants. Unlinked legacy flags and approvals without valid codes need separate investigation; do not attach records using vendorData or names alone.

No production database access or aggregate counts were available in this task. No production reconciliation has run. After reviewing the inventory, use the existing bounded provider re-poll workflow against the candidate account/session scope, with fresh authenticated provider decisions; never bulk UPDATE is_verified. Deployment of the updated polling code would expand its candidate selection and therefore needs that review first. No schema or new environment variable is needed for this badge fix.

## Validation and external context

Private PostgreSQL regressions cover approved replay, pending and terminal outcomes, invalid/missing codes, superseded links, duplicate delivery, underage evidence, aggregate counts and unchanged adult flags. Existing Veriff signature/decision tests and badge-rendering tests are also run. This is synthetic evidence, not provider activation or live user repair.

The user-referenced verification.call.com tab displayed an offline browser error. No repository integration for that domain was found in backend/frontend source. Its role and any successful verification are unconfirmed; no biometric submission or new session was attempted.
