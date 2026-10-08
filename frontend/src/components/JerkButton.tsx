import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { trackEvent } from '../observability/analytics';
import { IconJerk } from './icons/IconJerk';
import {
  JERK_LABEL,
  JERK_SENT_TOAST,
  JERK_TOAST_MS,
  jerkErrorMessage,
  type JerkApiResult,
  type JerkSurface,
} from '../lib/jerk';

type Variant = 'icon' | 'pill';

interface JerkButtonProps {
  userId: string;
  name: string;
  surface: JerkSurface;
  /** icon = square icon only (grid card); pill = icon + "Jerk" (profile, pin sheet, chat). */
  variant?: Variant;
  className?: string;
  onSent?: (result: JerkApiResult) => void;
}

/**
 * One-tap Jerk. Calls POST /users/jerk/:id (never a like or a match),
 * shows a brief "Sent 😏" toast, and handles the 429 daily cap kindly.
 * Report / Block stay under the three-dots menu, never next to this.
 */
export function JerkButton({
  userId,
  name,
  surface,
  variant = 'pill',
  className = '',
  onSent,
}: JerkButtonProps) {
  const selfId = useAuthStore((s) => s.user?.id);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'warn' } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback((msg: string, tone: 'ok' | 'warn') => {
    setToast({ msg, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), JERK_TOAST_MS);
  }, []);

  const send = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (state !== 'idle') return;
      setState('sending');
      try {
        const res = await usersAPI.jerkUser(userId);
        setState('sent');
        flash(JERK_SENT_TOAST, 'ok');
        trackEvent('jerk_sent', { surface, repeat: res.data?.status === 'repeat' });
        onSent?.(res.data);
      } catch (err) {
        setState('idle');
        flash(jerkErrorMessage(err), 'warn');
      }
    },
    [state, userId, surface, flash, onSent],
  );

  if (!userId || userId === selfId) return null;

  const sent = state === 'sent';
  const label = sent ? `Jerk sent to ${name}` : `Jerk ${name}`;
  const base =
    'inline-flex items-center justify-center gap-2 border font-black transition-all active:scale-[0.96] disabled:cursor-default';
  const tone = sent
    ? 'border-[var(--copper,#C4832A)] bg-[var(--copper,#C4832A)] text-[#1A0E03]'
    : 'border-[var(--copper,#C4832A)]/60 bg-[rgba(196,131,42,0.14)] text-[var(--copper,#C4832A)] hover:bg-[rgba(196,131,42,0.26)]';
  const shape =
    variant === 'icon'
      ? 'h-8 w-8 shrink-0 rounded-lg md:h-9 md:w-9 md:rounded-xl'
      : 'min-h-[48px] rounded-xl px-5 text-lg tracking-wide';

  return (
    <>
      <button
        type="button"
        onClick={(e) => void send(e)}
        disabled={state !== 'idle'}
        aria-disabled={state !== 'idle'}
        aria-label={label}
        title={JERK_LABEL}
        data-testid={`jerk-button-${surface}`}
        data-jerk-state={state}
        className={`${base} ${tone} ${shape} ${className}`}
      >
        <IconJerk size={variant === 'icon' ? 20 : 24} filled={sent} />
        {variant === 'pill' ? <span>{JERK_LABEL}</span> : null}
      </button>
      {toast && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              data-testid="jerk-toast"
              className="pointer-events-none fixed inset-x-0 bottom-[max(6rem,calc(env(safe-area-inset-bottom,0px)+6rem))] z-[3100] flex justify-center px-4"
            >
              <span
                className={`rounded-full border px-6 py-3 text-xl font-black shadow-2xl backdrop-blur-md ${
                  toast.tone === 'ok'
                    ? 'border-[#C4832A]/60 bg-[rgba(13,10,6,0.92)] text-[#F0E0C0]'
                    : 'border-[#C4832A]/40 bg-[rgba(13,10,6,0.92)] text-[#E0A14A]'
                }`}
              >
                {toast.msg}
              </span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
