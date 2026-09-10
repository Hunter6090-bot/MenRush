import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const VIEW_KEY = 'menrush.beta.feedback.views';
const LAST_KEY = 'menrush.beta.feedback.last';
const PROMPT_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * A deliberately light beta prompt: it appears only after several page views,
 * never more than once a fortnight, and never blocks the current task.
 */
export function BetaFeedbackPrompt() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '/contact') return;
    try {
      const last = Number(localStorage.getItem(LAST_KEY) || 0);
      if (Date.now() - last < PROMPT_INTERVAL_MS) return;
      const views = Number(sessionStorage.getItem(VIEW_KEY) || 0) + 1;
      sessionStorage.setItem(VIEW_KEY, String(views));
      if (views >= 5) setOpen(true);
    } catch {
      // Storage may be unavailable in private browsing; do not interrupt use.
    }
  }, [location.pathname]);

  if (!open) return null;

  const rememberPrompt = () => {
    try {
      localStorage.setItem(LAST_KEY, String(Date.now()));
      sessionStorage.removeItem(VIEW_KEY);
    } catch {
      // Best effort only.
    }
    setOpen(false);
  };

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(var(--mobile-tab-bar-height)+0.75rem)] z-40 rounded-2xl border border-[var(--copper)]/40 bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-lg)] lg:bottom-5 lg:left-auto lg:right-5 lg:w-80"
      aria-label="Beta feedback"
    >
      <button
        type="button"
        onClick={rememberPrompt}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-lg text-[var(--cream-muted)] hover:bg-[var(--bg-primary)]"
        aria-label="Dismiss beta feedback prompt"
      >
        ×
      </button>
      <p className="pr-8 text-sm font-bold text-[var(--cream)]">How are you finding the beta?</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--cream-muted)]">
        Tell us what feels broken or what you want improved.
      </p>
      <Link
        to="/contact"
        onClick={rememberPrompt}
        className="mt-3 inline-flex rounded-full bg-[var(--copper)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--nn-on-copper)]"
      >
        Share feedback
      </Link>
    </aside>
  );
}
