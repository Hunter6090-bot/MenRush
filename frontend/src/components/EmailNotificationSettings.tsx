import { useEffect, useState } from 'react';
import { emailNotificationsAPI, type EmailNotifyPrefs } from '../api/client';

const ROWS: Array<{
  key: keyof EmailNotifyPrefs;
  label: string;
  comingSoon?: boolean;
}> = [
  { key: 'messages', label: 'Messages' },
  { key: 'matches', label: 'Matches' },
  { key: 'jerks', label: 'Jerks', comingSoon: true },
];

const DEFAULT_PREFS: EmailNotifyPrefs = { messages: true, matches: true, jerks: true };

/**
 * Server-saved activity-mail ticks. All three start on. Jerks stays behind
 * the product hold (#325/#326) with a muted Coming soon tag.
 */
export function EmailNotificationSettings() {
  const [prefs, setPrefs] = useState<EmailNotifyPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<keyof EmailNotifyPrefs | null>(null);

  useEffect(() => {
    let live = true;
    const load = emailNotificationsAPI?.get;
    if (typeof load !== 'function') {
      setReady(true);
      return () => {
        live = false;
      };
    }
    void load()
      .then((res) => {
        if (!live) return;
        setPrefs({ ...DEFAULT_PREFS, ...res.data });
      })
      .catch(() => {
        /* keep defaults until the next visit */
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const toggle = async (key: keyof EmailNotifyPrefs) => {
    if (busy) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setBusy(key);
    try {
      const res = await emailNotificationsAPI.update({ [key]: next[key] });
      setPrefs({ ...DEFAULT_PREFS, ...res.data });
    } catch {
      setPrefs(prefs);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      id="email-notifications"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-default)]/60 shadow-card"
      data-testid="email-notification-settings"
    >
      {ROWS.map((row) => {
        const on = prefs[row.key];
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => void toggle(row.key)}
            disabled={!ready || busy === row.key}
            aria-pressed={on}
            aria-label={`${row.label} email notifications`}
            data-testid={`email-notify-${row.key}`}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 p-4 text-left text-[15px] transition-colors hover:bg-[var(--bg-elevated)]/50 disabled:opacity-70 sm:p-5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-[15px] font-bold text-[var(--cream)]">{row.label}</span>
              {row.comingSoon ? (
                <span
                  className="shrink-0 rounded-full border border-[var(--border-default)] px-2 text-[15px] font-medium leading-[22px] text-[var(--cream-muted)]"
                  data-testid="email-notify-jerks-soon"
                >
                  Coming soon
                </span>
              ) : null}
            </span>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ${
                on ? 'bg-[var(--copper)]' : 'bg-[var(--border-default)]'
              }`}
              aria-hidden
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-[var(--cream)] shadow-sm ${
                  on ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
