/**
 * Destructive confirm (delete post / comment / all posts). Theme tokens only,
 * so light and dark both meet WCAG AA (contrast test: confirmStyles.contrast.test.tsx).
 * 15px text, 44px buttons.
 */
export const CONFIRM_BOX =
  'rounded-xl border border-[var(--nn-danger-text)] bg-[var(--bg-elevated)] p-3 text-[15px] text-[var(--cream)]';
export const CONFIRM_TITLE = 'text-[15px] font-bold text-[var(--nn-danger-text)]';
export const CONFIRM_BODY = 'mt-0.5 text-[15px] leading-snug text-[var(--cream)]';
export const CONFIRM_DANGER_BTN =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full bg-[var(--nn-danger-text)] px-4 py-2 text-[15px] font-bold text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:opacity-50 touch-manipulation';
export const CONFIRM_CANCEL_BTN =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-[var(--border-default)] px-4 py-2 text-[15px] font-bold text-[var(--cream)] hover:bg-[var(--bg-card)] disabled:opacity-50 touch-manipulation';
