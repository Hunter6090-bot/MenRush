import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface OwnPostMenuItem {
  label: string;
  onSelect: () => void;
  testId?: string;
  danger?: boolean;
}

export const MENU_VIEWPORT_MARGIN = 8;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Where to put the menu so it always stays on screen with an 8px margin.
 * Prefers opening under the trigger, right-aligned to it; if that would run
 * off the left edge it anchors to the trigger's left edge instead; then it is
 * clamped inside the viewport. Flips above the trigger if there is no room below.
 */
export function placeMenu(
  trigger: Rect,
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = MENU_VIEWPORT_MARGIN,
): { left: number; top: number; maxWidth: number } {
  const maxWidth = Math.max(0, viewport.width - margin * 2);
  const width = Math.min(menu.width, maxWidth);
  let left = trigger.right - width;
  if (left < margin) left = trigger.left;
  left = Math.min(left, viewport.width - margin - width);
  left = Math.max(margin, left);

  let top = trigger.bottom + 4;
  if (top + menu.height > viewport.height - margin) {
    const above = trigger.top - 4 - menu.height;
    top = above >= margin ? above : Math.max(margin, viewport.height - margin - menu.height);
  }
  return { left, top, maxWidth };
}

/** Horizontal three dots (•••), drawn at 20px inside the 44px trigger. */
export function ThreeDotsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="2.1" />
      <circle cx="12" cy="12" r="2.1" />
      <circle cx="19" cy="12" r="2.1" />
    </svg>
  );
}

/**
 * ••• menu on the member's own post (map feed and Community).
 * Trigger is 44×44; rows are 15px text with 44px tap targets.
 * The menu is portalled to <body> with fixed positioning (the map dock uses
 * backdrop-filter, which would otherwise trap a fixed child) and placed by
 * placeMenu() so it never leaves the viewport.
 * Escape, outside tap and picking a row close it and return focus to the trigger.
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
  const [pos, setPos] = useState<{ left: number; top: number; maxWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const place = useCallback(() => {
    const t = triggerRef.current;
    const m = menuRef.current;
    if (!t || !m) return;
    const tr = t.getBoundingClientRect();
    const mr = m.getBoundingClientRect();
    setPos(
      placeMenu(
        { left: tr.left, right: tr.right, top: tr.top, bottom: tr.bottom },
        { width: mr.width, height: mr.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (refocus: boolean) => {
      setOpen(false);
      if (refocus) triggerRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, place]);

  const dark = tone === 'dark';
  const triggerClass = dark
    ? 'text-[#E8D9B8] hover:text-[#E0A14A]'
    : 'text-[var(--cream-muted)] hover:text-[var(--nn-accent-text)]';
  const panelClass = dark
    ? 'border-[rgba(196,131,42,0.35)] bg-[#1A130B]'
    : 'border-[var(--border-default)] bg-[var(--bg-elevated)]';
  const rowClass = (danger?: boolean) =>
    danger
      ? dark
        ? 'text-[#FF9A8A] hover:bg-[rgba(255,255,255,0.06)]'
        : 'text-[var(--nn-danger-text)] hover:bg-[var(--bg-card)]'
      : dark
        ? 'text-[#F0DFC0] hover:bg-[rgba(255,255,255,0.06)]'
        : 'text-[var(--cream)] hover:bg-[var(--bg-card)]';

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      data-testid={testId ? `${testId}-menu` : undefined}
      className={`fixed z-[80] min-w-[10rem] overflow-hidden rounded-xl border p-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${panelClass}`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        maxWidth: pos?.maxWidth,
        // Hidden for the one layout pass before it is measured and placed.
        visibility: pos ? 'visible' : 'hidden',
      }}
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
  ) : null;

  return (
    <div className="relative shrink-0">
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
        <ThreeDotsIcon />
      </button>
      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
}
