CCBill webhook verification and idempotency

Tracking issue: #48. Implements fail-closed webhook authenticity verification and idempotent, audited processing for CCBill payment webhooks (activation, renewal, cancellation, expiry, refund, chargeback).

What changed

Verification now fails closed. If CCBILL_WEBHOOK_SECRET is not set, every webhook call is rejected, in every environment, including local and dev. The only exception is an explicit local-only bypass (CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV=true), and that bypass is ignored whenever NODE_ENV=production, so it cannot take effect in a production deployment regardless of how the flag is set. Previously, an unset secret was silently treated as verified in every environment, including production.

The secret comparison is now constant-time (crypto.timingSafeEqual) instead of a plain string comparison.

Every webhook event is now required to resolve to a stable provider event identifier before it is processed. That identifier, together with the provider name, is enforced as unique by a database constraint, so a duplicate delivery or manual replay of the same event is a no-op rather than a second entitlement write.

Events are classified into one of activation, renewal, cancellation, expiry, refund, chargeback, or other. Refund and chargeback are tracked as distinct categories even though both currently deactivate Premium in the same way as cancellation and expiry, so that future reward-reversal logic (issues #39, #40) can treat them differently without another schema change.

A minimal audit trail is kept in the new processed_webhook_events table: provider, provider event id, event type, category, associated user and subscription id, an occurred-at timestamp when the provider supplies one, processing status, and timestamps. No raw webhook payloads, card numbers, or other payment account details are stored.

An out-of-order guard compares the incoming event's timestamp against the most recently processed event for the same subscription, and skips applying an entitlement change if the incoming event is older, while still recording it for audit.

Database migration

029_ccbill_webhook_events.sql (mirrored in database/migrations and backend/database/migrations) creates processed_webhook_events with a unique index on (provider, provider_event_id), plus supporting indexes for subscription lookups and category reporting. This is additive only: no existing table or column is altered or dropped.

Environment variables

CCBILL_WEBHOOK_SECRET: already existed; now effectively required. If unset, all webhook calls are rejected.

CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV (new, optional): local/dev-only bypass for testing without a configured secret. Ignored in production. Must never be set in a deployed environment.

Known assumptions and open risks

The exact field CCBill uses to carry the shared secret value (webhookSecret / X-webhookSecret / digest) reflects the merchant configuration already in use before this change and has not been reconfirmed against CCBill's current webhook or DataLink signing documentation. This should be verified with CCBill merchant support or current documentation before relying on it as the sole authenticity check in production.

Classic CCBill postbacks are not confirmed to include a single dedicated "event id" field across every event type. This change prefers an explicit id field when one is present, and otherwise derives an identifier from event type, subscription id, and timestamp. That fallback reduces, but does not eliminate, replay risk if CCBill ever resends an identical event with a changed timestamp. This is an open follow-up, not a solved problem.

Refund and chargeback still deactivate Premium the same way cancellation and expiry do. No reward-reversal behaviour is implemented here; that is explicitly out of scope for this change and belongs to issues #39 and #40.

Rollback considerations

The code change can be reverted independently of the migration: reverting backend/src/services/ccbill.service.ts and backend/src/services/premium.service.ts to their pre-change versions restores the previous (fail-open) webhook handling without requiring a schema rollback, because the old code paths do not reference processed_webhook_events.

The migration is additive (a new table and indexes only) and does not need to be rolled back to revert the application behaviour. If the table needs to be removed, DROP TABLE IF EXISTS processed_webhook_events; is sufficient and does not affect the users or subscriptions tables.

Before enabling fail-closed verification in production, confirm CCBILL_WEBHOOK_SECRET is actually set in the production environment. If it is not, this change will cause CCBill webhooks to start being rejected where they were previously accepted unverified. This is the intended security fix, but it is an operational change that should be confirmed with whoever owns the CCBill merchant configuration before deployment.
