# Verotel release contract — 24 September 2026

Status: local implementation with isolated database/HTTP evidence; **not provider-certified, activated or deployed**. Public subscribe still returns billing_not_configured. Sandbox URL preparation is server-only and does not make a provider request.

## Provider source of truth

- https://controlcenter.verotel.com/flexpay-doc/subscription.html (FlexPay v4, retrieved 24 September 2026)
- https://github.com/verotel/flexpay-php-client/blob/master/src/Verotel/FlexPay/Client.php (official canonicalisation implementation)

Use the merchant Control Center's approved contract before activation. Require SHA-256 and postback version 2 transaction IDs; legacy SHA-1 is deliberately unsupported. Callbacks are GET, decoded UTF-8 fields sorted by name and signed with the signature-key prefix. Respond plain `OK` only after COMMIT. Provider documentation warns that failed acknowledgement can cause an automatic refund: this is why unsupported/conflicting events require a sandbox exercise before any live payment.

## Implemented narrow plan

Recurring Premium, £6.99, GBP, P30D, no trial or discount. Initial/rebill/cancel/expiry/credit/chargeback use exact event names. Declines and arbitrary eventType/userId/custom1 inputs cannot activate access. Duplicate query keys, nested fields, malformed signatures, missing keys, other shops and unknown orders are rejected before database access where applicable.

Server-created random reference IDs bind an order to a user, shop and sandbox/production environment. The first authenticated sale binds that order permanently to a sale ID; uniqueness also prevents cross-order sale reuse. Callback-supplied user IDs are never used. Checkout signatures carry the opaque reference, not a user identifier.

Events, subscription rows, and user entitlement projection update in one transaction under a user lock. Each provider transaction ID is unique per shop; semantic differences with the same identity fail closed. A cancellation retains the paid-through period. Period extension is monotonic for successful rebills; cancellation caps the period; expiry, terminating refund and chargeback are terminal regardless of delivery order. Rebill-before-initial is retained without granting access until initial arrives. Refund-before-initial cannot resurrect access. Partial nonterminating credits retain access and remain audit records.

There is no documented global sequence or event timestamp in these payloads, so arrival time is never treated as event order. `uncancel`, `extend`, `downgrade`, `upgrade`, trials, discounted rebills and one-time purchases are rejected for reconciliation, rather than guessed. Disable those merchant features for this narrow contract or implement status-API reconciliation before enabling them. No referral commissions or payouts are triggered from callback delivery.

Independent existing grants are preserved separately from the projected paid grant. An unexpected change to legacy user entitlement fields causes `entitlement_reconciliation_required` and transaction rollback: the service does not guess whether a new promo/manual grant belongs to billing. Existing unbound subscriptions also require reconciliation. The manual-invoice PR must share an entitlement ledger or be reconciled explicitly before joint activation. This is a release blocker, not a complete general-purpose entitlement migration.

Only whitelisted financial event fields are stored; no raw signed query, signature, card fragment, email or custom payload is retained. Account deletion removes the user binding but retains non-identifying order/event tombstones for deduplication. Define the final accounting retention policy separately. Configure proxy/access logs to redact callback query strings before activation.

## Configuration and migrations

Apply mirrored `068_verotel_events.sql` before enabling callbacks. It creates new tables and does not trust/backfill legacy provider references. The separate mandatory-age patch uses067; the manual-invoice PR also proposes067 under a different filename, and must be renumbered/reconciled before integration.

Required names: `VEROTEL_POSTBACKS_ENABLED=true`, `VEROTEL_SHOP_ID`, `VEROTEL_SIGNATURE_KEY`, `VEROTEL_ENVIRONMENT=sandbox|production`. Leave callbacks disabled without an approved shop and verified contract. `VEROTEL_SANDBOX_CHECKOUT_ENABLED=true` permits server-only sandbox URL preparation in a non-production runtime. It requires a genuinely provider-approved sandbox shop on an isolated test database; the flag alone does not prove merchant sandbox status. Production runtime rejects sandbox configuration. Public checkout remains disabled unconditionally in this revision.

## Verification

`VEROTEL_TEST_PG_SOCKET=/private/tmp/menrush-verotel-pg-20260924/socket npm --prefix backend run test:verotel`

59 assertions passed against a fresh isolated PostgreSQL instance and local HTTP router. The runner uses a fixed test user/port and a random schema; it replaces DATABASE_URL before importing services, drops its schema and never contacts Verotel. Coverage includes malformed/missing/tampered signatures, wrong shop, duplicate keys, cross-user/reference/sale binding, exact amounts/currency, duplicate concurrent delivery, out-of-order initial/rebill/cancel/refund, partial refund, terminal expiry/chargeback, independent grants, owner grants, database rollback/retry, account deletion, exact HTTP acknowledgement and disabled legacy POST/HEAD.

CI provisions a temporary PostgreSQL instance with a Unix socket only, runs the same checks, and stops the instance. Billing-disabled checks assert zero database access. These are synthetic signed fixtures, not live sandbox transactions.

## Required provider evidence before activation

On a confirmed sandbox shop and isolated accounts, record provider transaction IDs and redacted results for checkout success/decline, recurring renewal, duplicate resend, reordered events, cancel and paid-through expiry, full/partial credit and chargeback. Verify merchant timezone interpretation of date-only paid-through values (implementation currently treats dates as UTC midnight), callback version, fixed price/currency/period, refund acknowledgement behavior and disabled unsupported features. Validate a callback failure/retry and a server crash between processing and acknowledgement. No customer charge, refund, merchant approval or sandbox transaction was performed by this task.
