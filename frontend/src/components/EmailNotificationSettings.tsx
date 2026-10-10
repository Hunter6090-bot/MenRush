import { useEffect, useState } from 'react';
import { emailNotificationsAPI, type EmailNotifyPrefs } from '../api/client';

const ROWS: Array<{
  key: keyof EmailNotifyPrefs;
  label: string;
  needsJerkFlag?: boolean;
}> = [
  { key: 'messages', label: 'Messages' },
  { key: 'matches', label: 'Matches' },
  { key: 'jerks', label: 'Jerks', needsJerkFlag: true },
];

const DEFAULT_PREFS: EmailNotifyPrefs = { messages: true, matches: true, jerks: true };

export interface EmailNotificationSettingsProps {
  flush?: boolean;
}

/**
 * Server-saved activity-mail ticks. Folded into the Notifications card.
 * Hidden entirely when EMAIL_NOTIFICATIONS_ENABLED is off. Jerks stays
 * hidden until EMAIL_NOTIFY_JERK_ENABLED.
 */
export function EmailNotificationSettings({ flush = false }: EmailNotificationSettingsProps) {
  const [prefs, setPrefs] = useState<EmailNotifyPrefs>(DEFAULT_PREFS);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [jerkEnabled, setJerkEnabled] = useState(false);
  const [busy, setBusy] = useState<keyof EmailNotifyPrefs | null>(null);

  useEffect(() => {
    let live = true;
    const load = emailNotificationsAPI?.get;
    if (typeof load !== 'function') {
      setEnabled(false);
      return () => {
        live = false;
      };
    }
    void load()
      .then((res) => {
        if (!live) return;
        const data = res.data ?? {};
        setEnabled(Boolean(data.enabled));
        setJerkEnabled(Boolean(data.jerkEnabled));
        setPrefs({
          messages: data.messages ?? true,
          matches: data.matches ?? true,
          jerks: data.jerks ?? true,
        });
      })
      .catch(() => {
        if (live) setEnabled(false);
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
      setPrefs({
        messages: res.data.messages ?? next.messages,
        matches: res.data.matches ?? next.matches,
        jerks: res.data.jerks ?? next.jerks,
      });
      if (typeof res.data.enabled === 'boolean') setEnabled(res.data.enabled);
      if (typeof res.data.jerkEnabled === 'boolean') setJerkEnabled(res.data.jerkEnabled);
    } catch {
      setPrefs(prefs);
    } finally {
      setBusy(null);
    }
  };

  if (enabled === null) {
    return <div id="email-notifications" className="scroll-mt-24" data-testid="email-notifications-anchor" />;
  }

  if (!enabled) return null;

  const rows = ROWS.filter((row) => !row.needsJerkFlag || jerkEnabled);

  return (
    <div
      className={
        flush
          ? 'divide-y divide-[var(--border-default)]/60'
          : 'overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-default)]/60 shadow-card'
      }
      data-testid="email-notification-settings"
    >
      <div
        id="email-notifications"
        data-testid="email-notifications-heading"
        className="scroll-mt-24 px-4 pb-2 pt-4 sm:px-5"
      >
        <p className="text-[15px] font-bold text-[var(--cream)]">Email notifications</p>
        <p className="mt-0.5 text-[15px] text-[var(--cream-muted)]">Email me about</p>
      </div>
      {rows.map((row) => {
        const on = prefs[row.key];
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => void toggle(row.key)}
            disabled={busy === row.key}
            aria-pressed={on}
            aria-label={`${row.label} email notifications`}
            data-testid={`email-notify-${row.key}`}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 p-4 text-left text-[15px] transition-colors hover:bg-[var(--bg-elevated)]/50 disabled:opacity-70 sm:p-5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-[15px] font-bold text-[var(--cream)]">{row.label}</span>
            </span>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full box-border ${
                on
                  ? 'bg-[var(--copper)]'
                  : 'border-2 border-[var(--cream)] bg-[var(--bg-elevated)]'
              }`}
              aria-hidden
              data-testid={`email-notify-${row.key}-track`}
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
