import { StatsigClient } from '@statsig/js-client';
import { getInstallPlatform, isStandaloneDisplay } from '../lib/pwaInstall';

type AnalyticsEvent =
  | 'landing_viewed'
  | 'waitlist_attempted'
  | 'waitlist_succeeded'
  | 'waitlist_failed'
  | 'verification_transition'
  | 'location_permission_outcome'
  | 'first_discovery_load'
  | 'first_message_success'
  | 'install_prompt_shown'
  | 'install_prompt_dismissed'
  | 'install_cta_clicked'
  | 'install_native_available'
  | 'install_native_outcome'
  | 'install_guide_viewed'
  | 'install_guide_step'
  | 'install_guide_done'
  | 'install_success';

type MetadataValue = string | number | boolean;
type EventMetadata = Record<string, MetadataValue | undefined>;

const ATTRIBUTION_METADATA_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
const INSTALL_METADATA_KEYS = ['platform', 'surface', 'method', 'outcome', 'source', 'step'] as const;

const ALLOWED_METADATA: Record<AnalyticsEvent, ReadonlySet<string>> = {
  landing_viewed: new Set(['surface', ...ATTRIBUTION_METADATA_KEYS]),
  waitlist_attempted: new Set(['transport']),
  waitlist_succeeded: new Set(['transport', 'already_subscribed', ...ATTRIBUTION_METADATA_KEYS]),
  waitlist_failed: new Set(['stage', 'transport']),
  verification_transition: new Set(['state']),
  location_permission_outcome: new Set(['outcome']),
  first_discovery_load: new Set(['outcome', 'result_bucket']),
  first_message_success: new Set(['kind', 'surface']),
  install_prompt_shown: new Set(INSTALL_METADATA_KEYS),
  install_prompt_dismissed: new Set(INSTALL_METADATA_KEYS),
  install_cta_clicked: new Set(INSTALL_METADATA_KEYS),
  install_native_available: new Set(INSTALL_METADATA_KEYS),
  install_native_outcome: new Set(INSTALL_METADATA_KEYS),
  install_guide_viewed: new Set(INSTALL_METADATA_KEYS),
  install_guide_step: new Set(INSTALL_METADATA_KEYS),
  install_guide_done: new Set(INSTALL_METADATA_KEYS),
  install_success: new Set(INSTALL_METADATA_KEYS),
};

let client: StatsigClient | null = null;
let installTrackingStarted = false;

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

function startInstallTracking(): void {
  if (typeof window === 'undefined' || installTrackingStarted) return;
  installTrackingStarted = true;

  const platform = getInstallPlatform();
  if (isStandaloneDisplay()) {
    trackEventOnce(
      'install_success',
      { platform, method: 'standalone', source: 'display_mode' },
      'install_success',
    );
  }

  window.addEventListener('appinstalled', () => {
    trackEventOnce(
      'install_success',
      { platform: getInstallPlatform(), method: 'native', source: 'appinstalled' },
      'install_success',
    );
  });
}

export function initializeAnalytics(): void {
  const clientKey = String(import.meta.env.VITE_STATSIG_CLIENT_KEY || '').trim();
  if (!clientKey || client) {
    startInstallTracking();
    return;
  }

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
  startInstallTracking();
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

/**
 * First-touch, session-scoped UTM attribution — same sessionStorage pattern
 * as getAnonymousSessionId. Captured once from the URL on first read, then
 * cached for the session so it survives from landing through to signup even
 * though those are two separate trackEvent calls.
 */
export function getAttributionParams(): Partial<Record<(typeof ATTRIBUTION_METADATA_KEYS)[number], string>> {
  const storageKey = 'menrush_attribution';
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return JSON.parse(existing);
  } catch {
    // fall through to read from URL
  }

  const params = new URLSearchParams(window.location.search);
  const captured: Record<string, string> = {};
  for (const key of ATTRIBUTION_METADATA_KEYS) {
    const value = params.get(key);
    if (value) captured[key] = value.slice(0, 100); // bound length defensively
  }
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(captured));
  } catch {
    // Storage may be blocked; the caller still gets this call's values.
  }
  return captured;
}

export function discoveryResultBucket(count: number): string {
  if (count === 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  return '21+';
}
