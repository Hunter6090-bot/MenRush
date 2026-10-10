import { useEffect, useState } from 'react';
import {
  enablePushNotifications,
  getPushSupport,
  iosNeedsHomeScreenForPush,
  isPushConfigured,
} from '../lib/push';
import { usePromptDismissal } from '../lib/promptDismissal';
import { PromptDismissControls } from './PromptDismissControls';

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
 * Each has "Don't remind me again" (owner ask, 10 Oct 2026). The same rule on
 * every phone. Alerts stay available in Settings, the app on /get-the-app.
 */
export function PushAlertBanner() {
  const [eligible, setEligible] = useState<'install' | 'alerts' | null>(null);
  const [busy, setBusy] = useState(false);
  const install = usePromptDismissal('install');
  const alerts = usePromptDismissal('alerts');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const configured = await isPushConfigured();
      if (cancelled || !configured) return;
      if (legacySnoozed()) return;
      if (iosNeedsHomeScreenForPush()) {
        setEligible('install');
        return;
      }
      if (getPushSupport() !== 'default') return;
      setEligible('alerts');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!eligible) return null;
  const iosInstall = eligible === 'install';
  const prompt = iosInstall ? install : alerts;
  if (prompt.hidden) return null;

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
