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
 * "Add MenRush to Home Screen" card only (Pete, 8 Oct 2026): "Don't show again"
 * hides it for good on this device. No server-side pref exists for this card.
 * Never cleared by any other code path.
 */
export const HOME_SCREEN_CARD_NEVER_KEY = 'menrush_home_screen_card_never';
/** The separate Get the app sheet (InstallPrompt) honours its own dismiss key. */
const INSTALL_PROMPT_DISMISS_KEY = 'menrush_install_prompt_dismissed';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

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
  const [neverAgain, setNeverAgain] = useState(() => readFlag(HOME_SCREEN_CARD_NEVER_KEY));

  useEffect(() => {
    void (async () => {
      const configured = await isPushConfigured();
      if (!configured) return;
      if (iosNeedsHomeScreenForPush()) {
        if (readFlag(HOME_SCREEN_CARD_NEVER_KEY)) return;
        try {
          const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
          if (until > Date.now()) return;
        } catch {
          /* ignore */
        }
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

  const setNeverAgainPref = (next: boolean) => {
    setNeverAgain(next);
    try {
      if (next) {
        localStorage.setItem(HOME_SCREEN_CARD_NEVER_KEY, '1');
        localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, '1');
      } else {
        localStorage.removeItem(HOME_SCREEN_CARD_NEVER_KEY);
      }
    } catch {
      /* ignore */
    }
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
      {iosInstall ? (
        <p className="mt-0.5 text-sm leading-snug text-[var(--cream-muted)]">
          Share → Add to Home Screen. Open it, then allow alerts.
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        {iosInstall ? (
          <>
            <label
              className="mr-auto inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[15px] font-semibold text-[var(--cream)]"
              data-testid="home-screen-card-never-label"
            >
              <input
                type="checkbox"
                checked={neverAgain}
                onChange={(e) => setNeverAgainPref(e.target.checked)}
                data-testid="home-screen-card-never"
                className="h-5 w-5 accent-[#C4832A]"
              />
              Don&apos;t show again
            </label>
            <button
              type="button"
              onClick={() => (neverAgain ? setVisible(false) : dismiss())}
              data-testid="home-screen-card-close"
              className="min-h-[44px] rounded-xl px-4 text-[15px] font-bold text-[var(--cream)]"
            >
              Close
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-[var(--cream-muted)]"
          >
            Later
          </button>
        )}
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
