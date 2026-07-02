import { StatsigClient } from '@statsig/js-client';

type AnalyticsEvent =
  | 'landing_viewed'
  | 'waitlist_attempted'
  | 'waitlist_succeeded'
  | 'waitlist_failed'
  | 'verification_transition'
  | 'location_permission_outcome'
  | 'first_discovery_load'
  | 'first_message_success';

type MetadataValue = string | number | boolean;
type EventMetadata = Record<string, MetadataValue | undefined>;

const ALLOWED_METADATA: Record<AnalyticsEvent, ReadonlySet<string>> = {
  landing_viewed: new Set(['surface']),
  waitlist_attempted: new Set(['transport']),
  waitlist_succeeded: new Set(['transport', 'already_subscribed']),
  waitlist_failed: new Set(['stage', 'transport']),
  verification_transition: new Set(['state']),
  location_permission_outcome: new Set(['outcome']),
  first_discovery_load: new Set(['outcome', 'result_bucket']),
  first_message_success: new Set(['kind', 'surface']),
};

let client: StatsigClient | null = null;

function getAnonymousSessionId(): string {
  const storageKey = 'menrush_analytics_session';
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function sanitizeMetadata(event: AnalyticsEvent, metadata: EventMetadata): Record<string, string> {
  const allowed = ALLOWED_METADATA[event];
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => allowed.has(key) && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

export function initializeAnalytics(): void {
  const clientKey = String(import.meta.env.VITE_STATSIG_CLIENT_KEY || '').trim();
  if (!clientKey || client) return;

  client = new StatsigClient(
    clientKey,
    { userID: getAnonymousSessionId() },
    {
      disableStableID: true,
      enableCookies: false,
      includeCurrentPageUrlWithEvents: false,
      environment: { tier: String(import.meta.env.VITE_APP_ENV || import.meta.env.MODE) },
    },
  );

  void client.initializeAsync().catch(() => {
    client = null;
  });
}

export function trackEvent(event: AnalyticsEvent, metadata: EventMetadata = {}): void {
  client?.logEvent(event, undefined, sanitizeMetadata(event, metadata));
}

export function trackEventOnce(
  event: AnalyticsEvent,
  metadata: EventMetadata = {},
  onceKey: string = event,
): void {
  const storageKey = `menrush_event_${onceKey}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, '1');
  } catch {
    // Storage may be blocked; logging the event is still safe.
  }
  trackEvent(event, metadata);
}

export function checkFeatureGate(gateName: string, fallback = false): boolean {
  if (!client) return fallback;
  try {
    return client.checkGate(gateName);
  } catch {
    return fallback;
  }
}

export function discoveryResultBucket(count: number): string {
  if (count === 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  return '21+';
}
