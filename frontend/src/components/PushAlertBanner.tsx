import { useEffect, useState } from 'react';
import {
  enablePushNotifications,
  getPushSupport,
  iosNeedsHomeScreenForPush,
  isPushConfigured,
  isStandalonePwa,
} from '../lib/push';

const SNOOZE_KEY = 'menrush_push_banner_snooze_until';
/** "Later" hides the banner briefly — never permanently while permission is still default. */
const SNOOZE_MS = 12 * 60 * 60 * 1000;

/**
 * Logged-in nudge so people actually get rings when the app is closed.
 * Never auto-prompts — iOS Safari would ignore it, and e2e forbids a silent
 * Notification.requestPermission on page load.
 *
 * Must stay visible in the installed PWA until alerts are granted or blocked.
 * A permanent dismiss while permission is still `default` hid call rings.
 */
export function PushAlertBanner() {
  const [visible, setVisible] = useState(false);
  const [iosInstall, setIosInstall] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const configured = await isPushConfigured();
      if (!configured) return;
      if (iosNeedsHomeScreenForPush()) {
        setIosInstall(true);
        setVisible(true);
        return;
      }
      const support = getPushSupport();
      if (support !== 'default') return;
      try {
        localStorage.removeItem('menrush_push_banner_dismissed');
        const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
        // Installed PWA: never hide for long — call rings depend on permission.
        if (until > Date.now() && !isStandalonePwa()) return;
      } catch {
        /* ignore */
      }
      setVisible(true);
    })();
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
      // Clear legacy permanent dismiss so older installs recover.
      localStorage.removeItem('menrush_push_banner_dismissed');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enablePushNotifications();
      if (result === 'granted') setVisible(false);
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
      <p className="mt-0.5 text-sm leading-snug text-[var(--cream-muted)]">
        {iosInstall
          ? 'iPhone: Share → Add to Home Screen. Open that icon, then allow alerts.'
          : 'Alerts still ring when MenRush is closed.'}
      </p>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl px-3 py-1.5 text-sm font-semibold text-[var(--cream-muted)]"
        >
          Later
        </button>
        {iosInstall ? null : (
          <button
            type="button"
            onClick={() => void enable()}
            disabled={busy}
            data-testid="push-alert-banner-enable"
            className="rounded-xl bg-[#C4832A] px-3 py-1.5 text-sm font-bold text-[#0D0A06] disabled:opacity-50"
          >
            Turn on
          </button>
        )}
      </div>
    </div>
  );
}
