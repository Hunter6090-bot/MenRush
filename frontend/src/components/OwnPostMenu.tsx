import { useEffect, useId, useRef, useState } from 'react';
import { IconMore } from './icons/IconMore';

export interface OwnPostMenuItem {
  label: string;
  onSelect: () => void;
  testId?: string;
  danger?: boolean;
}

/**
 * ••• menu on the member's own post (map feed and Community).
 * Trigger is 44×44; rows are 15px text with 44px tap targets.
 * Escape and picking a row close it and return focus to the trigger.
 */
export function OwnPostMenu({
  items,
  label = 'Post options',
  testId,
  tone = 'theme',
}: {
  items: OwnPostMenuItem[];
  label?: string;
  testId?: string;
  /** 'dark' for the always-dark map chat dock; 'theme' follows the app theme. */
  tone?: 'theme' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const dark = tone === 'dark';
  const triggerClass = dark
    ? 'text-[#C9B391] hover:text-[#E0A14A]'
    : 'text-[var(--cream-muted)] hover:text-[var(--nn-accent-text)]';
  const panelClass = dark
    ? 'border-[rgba(196,131,42,0.35)] bg-[#1A130B]'
    : 'border-[var(--border-default)] bg-[var(--bg-elevated)]';
  const rowClass = (danger?: boolean) =>
    danger
      ? dark
        ? 'text-[#FF9A8A] hover:bg-red-500/15'
        : 'text-[var(--nn-danger-text)] hover:bg-red-500/10'
      : dark
        ? 'text-[#F0DFC0] hover:bg-white/5'
        : 'text-[var(--cream)] hover:bg-[var(--bg-card)]';

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors touch-manipulation ${triggerClass}`}
      >
        <IconMore size={20} />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute right-0 top-full z-40 mt-1 min-w-[10rem] overflow-hidden rounded-xl border p-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${panelClass}`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-testid={item.testId}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                item.onSelect();
              }}
              className={`flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-[15px] font-bold transition-colors touch-manipulation ${rowClass(item.danger)}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
