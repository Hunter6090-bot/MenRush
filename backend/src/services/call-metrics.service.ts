/**
 * Lightweight call reliability metrics — structured logs for Railway / log drains.
 * No PII beyond opaque user ids. Safe to scrape with log-based metrics later.
 */

export type CallMetricEvent =
  | 'call_initiate'
  | 'call_offline'
  | 'call_offline_ringing'
  | 'call_incoming_emitted'
  | 'call_no_answer'
  | 'call_answer'
  | 'call_reject'
  | 'call_end'
  | 'call_error'
  | 'ice_relay_hint';

export function logCallMetric(
  event: CallMetricEvent,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  const payload = {
    ts: new Date().toISOString(),
    component: 'webrtc',
    event,
    ...fields,
  };
  // Single-line JSON for log aggregators.
  console.log(`[call-metrics] ${JSON.stringify(payload)}`);
}
