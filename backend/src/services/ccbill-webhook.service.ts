import { query } from '../db';

export type WebhookEventCategory =
    | 'activation'
  | 'renewal'
  | 'cancellation'
  | 'expiry'
  | 'refund'
  | 'chargeback'
  | 'other';

export interface WebhookEventRecord {
    eventId: string;
    eventType: string;
    category: WebhookEventCategory;
    userId: string | null;
    subscriptionId: string | null;
    occurredAt: Date | null;
}

export interface RecordAttemptResult {
    id: string;
    status: 'new' | 'duplicate';
}

type QueryResult = { rows: any[]; rowCount?: number | null };
type QueryFn = (text: string, values?: unknown[]) => Promise<QueryResult>;

/**
 * Classifies a raw CCBill event type string into an internal category.
 * Refunds and chargebacks are classified separately from plain
 * cancellation/expiry (even though all four currently deactivate Premium
 * the same way) so future reward-reversal logic (see issues #39, #40) can
 * treat them differently without another migration.
 */
export function classifyEventCategory(eventType: string): WebhookEventCategory {
  const type = (eventType || '').toLowerCase();
  if (type.includes('chargeback') || type.includes('dispute')) return 'chargeback';
  if (type.includes('refund')) return 'refund';
  if (type.includes('cancel')) return 'cancellation';
  if (type.includes('expir')) return 'expiry';
  if (type.includes('renewal')) return 'renewal';
  if (type.includes('newsale') || type.includes('new_sale')) return 'activation';
  return 'other';
}

const CANDIDATE_EVENT_ID_FIELDS = [
  'eventId',
  'event_id',
  'X-eventId',
  'denialId',
  'refundTransactionId',
  'chargebackTransactionId',
  'subscriptionId',
  'transactionId',
  ];


/**
 * Extracts a stable provider event identifier for idempotency.
 *
 * ASSUMPTION / RISK: classic CCBill DataLink postbacks do not guarantee a
 * single dedicated "event id" field across every webhook event type. This
 * function prefers an explicit id field when present, and otherwise
 * derives a deterministic identifier from the fields that are present
 * (event type plus subscription id plus timestamp). That fallback reduces,
 * but does not eliminate, replay risk if CCBill ever resends the same
 * event with a changed timestamp. This must be confirmed against current
 * CCBill merchant and webhook documentation before this is relied on as
 * the sole idempotency defence in production. See issue #48.
 */
export function extractProviderEventId(
  eventType: string,
  raw: Record<string, string>,
  ): string | null {
  for (const field of CANDIDATE_EVENT_ID_FIELDS) {
    const value = raw[field];
    if (value && value.trim()) {
      return `${field}:${value.trim()}`;
    }
  }

const timestamp = raw['timestamp'] || raw['eventDate'] || raw['transactionDate'];
  const subscriptionId = raw['subscriptionId'] || raw['subscription_id'];
  if (timestamp && subscriptionId) {
    return `derived:${eventType}:${subscriptionId}:${timestamp}`;
  }

return null;
}

export function extractOccurredAt(raw: Record<string, string>): Date | null {
  const candidate =
    raw['timestamp'] || raw['eventDate'] || raw['transactionDate'];
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}


export function createWebhookEventStore(runQuery: QueryFn) {
  return {
    /**
       * Records a processing attempt for this provider event id. The actual
     * idempotency boundary is the database unique constraint on
     * (provider, provider_event_id), not this application-level check, so
     * concurrent duplicate deliveries cannot both "win".
     */
    async recordAttempt(event: WebhookEventRecord): Promise<RecordAttemptResult> {
      const inserted = await runQuery(
        `INSERT INTO processed_webhook_events (
        provider, provider_event_id, event_type, event_category,
        user_id, subscription_id, occurred_at, status
        ) VALUES ('ccbill', $1, $2, $3, $4, $5, $6, 'processing')
        ON CONFLICT (provider, provider_event_id) DO NOTHING
        RETURNING id`,
        [
          event.eventId,
          event.eventType,
          event.category,
          event.userId,
          event.subscriptionId,
          event.occurredAt,
          ],
        );

    if (inserted.rows[0]?.id) {
      return { id: inserted.rows[0].id, status: 'new' };
    }

    const existing = await runQuery(
      `SELECT id FROM processed_webhook_events
       WHERE provider = 'ccbill' AND provider_event_id = $1`,
      [event.eventId],
      );
      return { id: existing.rows[0]?.id ?? '', status: 'duplicate' };
    },

    /**
       * True when a newer event has already been fully processed for this
     * subscription than the one currently being handled, which indicates
     * out-of-order delivery. Entitlement state should not move backwards.
     */
    async isOutOfOrder(subscriptionId: string, occurredAt: Date): Promise<boolean> {
      const last = await runQuery(
        `SELECT occurred_at FROM processed_webhook_events
         WHERE provider = 'ccbill'
            AND subscription_id = $1
               AND status = 'processed'
                  AND occurred_at IS NOT NULL
                   ORDER BY occurred_at DESC
                    LIMIT 1`,
        [subscriptionId],
        );
      const lastOccurredAt = last.rows[0]?.occurred_at;
      if (!lastOccurredAt) return false;
      return new Date(lastOccurredAt).getTime() > occurredAt.getTime();
    },

    async markProcessed(id: string): Promise<void> {
      if (!id) return;
      await runQuery(
        `UPDATE processed_webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`,
        [id],
        );
    },

    async markIgnoredOutOfOrder(id: string): Promise<void> {
      if (!id) return;
      await runQuery(
        `UPDATE processed_webhook_events SET status = 'ignored_out_of_order' WHERE id = $1`,
        [id],
        );
    },

    async markFailed(id: string): Promise<void> {
      if (!id) return;
      await runQuery(`UPDATE processed_webhook_events SET status = 'failed' WHERE id = $1`, [id]);
    },
  };
}

export const webhookEventStore = createWebhookEventStore(query);
