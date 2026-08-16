# CCBill webhook verification and idempotency

Tracking issue: [#48](https://github.com/Hunter6090-bot/MenRush/issues/48).
Implements fail-closed webhook authenticity verification and idempotent,
audited processing for CCBill payment webhooks (activation, renewal,
cancellation, expiry, refund, chargeback).

## What changed

Verification now **fails closed**. If `CCBILL_WEBHOOK_SECRET` is not set,
every webhook call is rejected, in every environment, including local and
dev. The only exception is an explicit local-only bypass
(`CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV=true`), and that bypass is ignored
whenever `NODE_ENV=production`, so it cannot take effect in a production
deployment regardless of how the flag is set. Previously, an unset secret
was silently treated as verified in every environment, including production.

The secret comparison is now constant-time (`crypto.timingSafeEqual`)
instead of a plain string comparison.

Every webhook event is now required to resolve to a stable provider event
identifier before it is processed. That identifier, together with the
provider name, is enforced as unique by a database constraint, so a
duplicate delivery or manual replay of the same event is a no-op rather
than a second entitlement write.

Events are classified into one of `activation`, `renewal`, `cancellation`,
`expiry`, `refund`, `chargeback`, or `other`. Refund and chargeback are
tracked as distinct categories even though both currently deactivate
Premium in the same way as cancellation and expiry, so that future
reward-reversal logic (issues #39, #40) can treat them differently without
another schema change.

A minimal audit trail is kept in the new `processed_webhook_events` table:
provider, provider event id, event type, category, associated user and
subscription id, an occurred-at timestamp when the provider supplies one,
processing status, and timestamps. No raw webhook payloads, card numbers,
or other payment account details are stored. Subscription `metadata`
likewise stores only a safe summary (`event_id`, `event_type`, `category`,
`processor_subscription_id`), never the raw postback.

An out-of-order guard compares the incoming event's timestamp against the
most recently processed event for the same subscription, and skips applying
an entitlement change if the incoming event is older, while still recording
it for audit.

## Database migration

`032_ccbill_webhook_events.sql` (mirrored in `database/migrations` and
`backend/database/migrations`) creates `processed_webhook_events` with a
unique index on `(provider, provider_event_id)`, plus supporting indexes
for subscription lookups and category reporting. This is additive only: no
existing table or column is altered or dropped.

Apply with:

```bash
cd backend && npm run db:migrate
```

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `CCBILL_WEBHOOK_SECRET` | Yes (effectively) | If unset, all webhook calls are rejected. Set after merchant approval; do not invent production secrets in this PR. |
| `CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV` | No | Local/dev-only bypass when the secret is unset. Ignored when `NODE_ENV=production`. Never set in any deployed environment. |

Also documented in `backend/.env.example`.

## Known assumptions and open risks (labeled hypotheses)

**Hypothesis H1 — shared-secret field (needs vendor confirmation):**
MenRush currently treats authenticity as a merchant-configured shared
secret echoed in a postback field (`webhookSecret` / `X-webhookSecret` /
`digest`), which is what the pre-#48 code already expected. Some
third-party CCBill integrations document HMAC-SHA256 over the raw body for
Webhooks 3.0. Until a live merchant account confirms the exact scheme
CCBill will send to MenRush, this change hardens the shared-secret path
(fail-closed + constant-time compare) and leaves HMAC adoption as a
follow-up once CCBill merchant support or current docs confirm it. Do not
invent production secrets here.

**Hypothesis H2 — event id field coverage:**
Classic CCBill postbacks are not confirmed to include a single dedicated
"event id" field across every event type. This change prefers an explicit
id field when one is present (`eventId`, `transactionId`,
`refundTransactionId`, `chargebackTransactionId`, `denialId`, …), and
otherwise derives an identifier from event type, subscription id, and
timestamp. That fallback reduces, but does not eliminate, replay risk if
CCBill ever resends an identical event with a changed timestamp. Open
follow-up after merchant onboarding.

Refund and chargeback still deactivate Premium the same way cancellation
and expiry do. No reward-reversal behaviour is implemented here; that is
explicitly out of scope and belongs to issues #39 and #40.

## Rollback considerations

1. **Application rollback (restores previous handler behaviour):** revert
   `backend/src/services/ccbill.service.ts`,
   `backend/src/services/ccbill-webhook.service.ts`,
   `backend/src/services/premium.service.ts`, and
   `backend/src/routes/premium-webhook.ts`. The old code paths do not
   reference `processed_webhook_events`, so schema rollback is not
   required to restore previous runtime behaviour.
2. **Schema rollback (optional):** the migration is additive. If the table
   must be removed:
   `DROP TABLE IF EXISTS processed_webhook_events;`
   This does not affect `users` or `subscriptions`.
3. **Operational note:** before enabling fail-closed verification in
   production, confirm `CCBILL_WEBHOOK_SECRET` is actually set in the
   production environment. If it is not, this change will cause CCBill
   webhooks to start being rejected where they were previously accepted
   unverified. That is the intended security fix, but it is an operational
   change that should be confirmed with whoever owns the CCBill merchant
   configuration before deployment. There is no live merchant account yet;
   this PR hardens code so approval can proceed without a fail-open webhook.

## Tests

```bash
cd backend && npm run test:webhook-security
```

Covers valid vs invalid signature, missing secret (production and non-prod),
dev bypass, classification (including refund vs chargeback), duplicate and
replayed event handling, out-of-order handling, provider-event-id /
occurred-at extraction, and safe metadata sanitization. Wired into
`.github/workflows/ci.yml` under the backend-build job.
