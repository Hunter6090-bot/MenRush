import { useEffect, useState } from 'react';
import {
  enablePushNotifications,
  getPushSupport,
  iosNeedsHomeScreenForPush,
  isPushConfigured,
} from '../lib/push';
import { usePromptDismissal } from '../lib/promptDismissal';
import { usePromptSlot, type PromptSlotState } from '../lib/promptSlot';
import { PromptDismissControls } from './PromptDismissControls';

/**
 * Device-wide "Don't show again" key from the redesign (#316). Still honoured as
 * already dismissed (see lib/promptDismissal LEGACY_NEVER_KEYS); never written now.
 */
export const HOME_SCREEN_CARD_NEVER_KEY = 'menrush_home_screen_card_never';

/** Older 12h "Later" snooze. Still honoured until it runs out; never written now. */
const LEGACY_SNOOZE_KEY = 'menrush_push_banner_snooze_until';

function legacySnoozed(): boolean {
  try {
    return Number(localStorage.getItem(LEGACY_SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Logged-in nudge so people actually get rings when the app is closed.
 * Never auto-prompts: iOS Safari would ignore it, and e2e forbids a silent
 * Notification.requestPermission on page load.
 *
 * Two prompts share this slot:
 * - iPhone Safari tab: "Add MenRush to Home Screen" (the get-the-app prompt).
 * - Everywhere else with permission still default: "Turn on alerts".
 * Each has "Don't show again" (owner ask, 10 Oct 2026). The same rule on
 * every phone. Alerts stay available in Settings, the app on /get-the-app.
 */
export function PushAlertBanner() {
  // undefined while still checking; null once we know nothing should show.
  const [eligible, setEligible] = useState<'install' | 'alerts' | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const install = usePromptDismissal('install');
  const alerts = usePromptDismissal('alerts');

  useEffect(() => {
    let cancelled = false;
    const decide = (value: 'install' | 'alerts' | null) => {
      if (!cancelled) setEligible(value);
    };
    void (async () => {
      try {
        const configured = await isPushConfigured();
        if (!configured || legacySnoozed()) return decide(null);
        if (iosNeedsHomeScreenForPush()) return decide('install');
        if (getPushSupport() !== 'default') return decide(null);
        decide('alerts');
      } catch {
        decide(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // One prompt at a time. While still checking, hold back Finish profile so it
  // does not flash up and then get replaced.
  // On a new device also wait for the member's server prefs (or the short
  // timeout), so the banner never shows and then vanishes.
  const ready = install.ready && alerts.ready;
  const slotState = (kind: 'install' | 'alerts', hidden: boolean): PromptSlotState => {
    if (eligible === undefined || !ready) return kind === 'install' ? 'pending' : 'none';
    if (eligible !== kind) return 'none';
    return hidden ? 'none' : 'want';
  };
  const installOnTop = usePromptSlot('install-banner', slotState('install', install.hidden));
  const alertsOnTop = usePromptSlot('alerts', slotState('alerts', alerts.hidden));

  if (!eligible || !ready) return null;
  const iosInstall = eligible === 'install';
  const prompt = iosInstall ? install : alerts;
  if (prompt.hidden) return null;
  if (!(iosInstall ? installOnTop : alertsOnTop)) return null;

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enablePushNotifications();
      if (result === 'granted') setEligible(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mx-3 mb-2 mt-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2.5 shadow-card"
      data-testid="push-alert-banner"
      role="status"
    >
      <p className="text-base font-semibold text-[var(--cream)]">
        {iosInstall ? 'Add MenRush to Home Screen' : 'Turn on alerts'}
      </p>
      {iosInstall ? (
        <p className="mt-0.5 text-[15px] leading-snug text-[var(--cream-muted)]">
          Share, then Add to Home Screen. Open it, then allow alerts.
        </p>
      ) : null}
      <PromptDismissControls
        onClose={prompt.close}
        closeLabel={iosInstall ? 'Close Add to Home Screen' : 'Close turn on alerts'}
        testIdPrefix={iosInstall ? 'install-prompt' : 'alerts-prompt'}
        className="mt-1"
      >
        {iosInstall ? null : (
          <button
            type="button"
            onClick={() => void enable()}
            disabled={busy}
            data-testid="push-alert-banner-enable"
            className="min-h-[44px] rounded-xl bg-[var(--copper)] px-4 text-[15px] font-bold text-[var(--nn-on-copper)] disabled:opacity-50"
          >
            Turn on
          </button>
        )}
      </PromptDismissControls>
    </div>
  );
}
