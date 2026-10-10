import { useEffect } from 'react';
import { EmailNotificationSettings } from '../components/EmailNotificationSettings';
import { applyTheme, type ThemePreference } from '../lib/theme';

/**
 * DEV harness — Email notifications Settings card in both themes.
 * Route: /dev/email-notifications
 */
export function EmailNotificationsPreview() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('theme');
    applyTheme(q === 'light' ? 'light' : 'dark');
  }, []);

  const setTheme = (theme: ThemePreference) => {
    applyTheme(theme);
    const url = new URL(window.location.href);
    url.searchParams.set('theme', theme);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="min-h-screen bg-[var(--nn-bg)] px-4 py-8 text-[var(--cream)]">
      <div className="mx-auto max-w-[620px]">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className="min-h-[44px] rounded-full border border-[var(--border-default)] px-4 text-[15px]"
            onClick={() => setTheme('dark')}
          >
            Night
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded-full border border-[var(--border-default)] px-4 text-[15px]"
            onClick={() => setTheme('light')}
          >
            Cream
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-default)]/60 shadow-card">
          <EmailNotificationSettings flush />
        </div>
      </div>
    </div>
  );
}
