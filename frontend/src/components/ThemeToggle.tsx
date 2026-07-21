import { useEffect, useState } from 'react';
import {
  cycleThemePreference,
  readThemePreference,
  resolveTheme,
  themePreferenceLabel,
  THEME_CHANGED_EVENT,
  type ThemePreference,
} from '../lib/theme';

type ThemeToggleVariant = 'header' | 'fab' | 'chat';

/**
 * Light / dark / system control. Tap cycles: Light → Dark → System.
 * Prefer `header` / `chat` placement; `fab` is a demoted fallback only.
 */
export function ThemeToggle({
  variant = 'header',
  className = '',
}: {
  variant?: ThemeToggleVariant;
  className?: string;
}) {
  const [pref, setPref] = useState<ThemePreference>(() => readThemePreference());

  useEffect(() => {
    const sync = () => setPref(readThemePreference());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ preference?: ThemePreference }>).detail;
      if (detail?.preference) setPref(detail.preference);
      else sync();
    };
    window.addEventListener(THEME_CHANGED_EVENT, onCustom);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, onCustom);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const resolved = resolveTheme(pref);
  const label = themePreferenceLabel(pref);
  const nextHint = pref === 'light' ? 'Dark' : pref === 'dark' ? 'System' : 'Light';

  const base =
    variant === 'fab'
      ? `
        fixed z-[60]
        left-[max(0.75rem,env(safe-area-inset-left,0px))]
        bottom-[calc(var(--fab-offset,16px)+var(--mobile-tab-bar-height,4rem)+0.5rem)]
        flex h-11 w-11 items-center justify-center rounded-full
        border border-[var(--border-default)]
        bg-[color-mix(in_srgb,var(--bg-elevated)_90%,transparent)]
        text-[var(--copper)]
        shadow-[var(--shadow-md)]
        backdrop-blur-md
        transition-transform duration-200
        hover:scale-105 hover:border-[var(--copper)]
        active:scale-95
        lg:bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]
      `
      : `
        shrink-0 flex h-10 w-10 items-center justify-center rounded-full
        text-[var(--cream-soft)]
        active:bg-[var(--bg-card)]
        transition-colors
        hover:text-[var(--copper)]
      `;

  return (
    <button
      type="button"
      data-testid={variant === 'fab' ? 'theme-toggle-fab' : 'theme-toggle'}
      onClick={() => setPref(cycleThemePreference())}
      aria-label={`Theme: ${label}. Switch to ${nextHint}.`}
      title={`Theme: ${label} (tap for ${nextHint})`}
      className={`${base} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)] ${className}`}
    >
      {pref === 'system' ? (
        <SystemIcon className="h-5 w-5" />
      ) : resolved === 'light' ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <BulbIcon className="h-5 w-5" />
      )}
      <span className="sr-only">
        {label} theme — tap for {nextHint}
      </span>
    </button>
  );
}

/** @deprecated Prefer ThemeToggle in headers. Kept for rare full-screen fallbacks. */
export function ThemeToggleFab() {
  return <ThemeToggle variant="fab" />;
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.5v2.25M12 19.25V21.5M21.5 12h-2.25M4.75 12H2.5M18.72 5.28l-1.59 1.59M6.87 17.13l-1.59 1.59M18.72 18.72l-1.59-1.59M6.87 6.87 5.28 5.28"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.1 1.1 1.85V17h4.8v-1.25c.1-.75.5-1.4 1.1-1.85A6 6 0 0 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SystemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M8 20.5h8M12 16.5v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
