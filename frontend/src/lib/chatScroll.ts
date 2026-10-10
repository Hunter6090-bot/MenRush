/**
 * 1:1 chat sticky-bottom / scroll-back helpers.
 *
 * Poll + socket + typing must not yank the viewport while the user is reading
 * history. Stick-to-bottom only when already near the bottom (or the user
 * just sent). Load-older prepends must preserve visual position via height delta.
 */

/** Distance from bottom (px) that still counts as "following" the live tip. */
export const CHAT_NEAR_BOTTOM_PX = 96;

/** How close to the top (px) before we fetch an older page. */
export const CHAT_LOAD_OLDER_TOP_PX = 72;

export function distanceFromBottom(el: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

/** True when the viewport is pinned near the newest messages. */
export function isNearBottom(
  el: { scrollTop: number; scrollHeight: number; clientHeight: number },
  thresholdPx: number = CHAT_NEAR_BOTTOM_PX,
): boolean {
  return distanceFromBottom(el) <= thresholdPx;
}

/** True when the user has scrolled up far enough that auto-stick must stay off. */
export function shouldStickToBottomOnUpdate(
  el: { scrollTop: number; scrollHeight: number; clientHeight: number } | null | undefined,
  opts?: { force?: boolean; thresholdPx?: number },
): boolean {
  if (opts?.force) return true;
  if (!el) return true;
  return isNearBottom(el, opts?.thresholdPx ?? CHAT_NEAR_BOTTOM_PX);
}

/**
 * After prepending older rows, restore the visual anchor the user was reading.
 * Call with scrollHeight captured *before* the DOM grew.
 */
export function restoreScrollAfterPrepend(
  el: { scrollTop: number; scrollHeight: number },
  prevScrollHeight: number,
): number {
  const delta = el.scrollHeight - prevScrollHeight;
  if (delta <= 0) return el.scrollTop;
  el.scrollTop += delta;
  return el.scrollTop;
}

export function shouldLoadOlderOnScroll(
  el: { scrollTop: number },
  opts?: { loading?: boolean; hasMore?: boolean; thresholdPx?: number },
): boolean {
  if (opts?.loading) return false;
  if (opts?.hasMore === false) return false;
  return el.scrollTop <= (opts?.thresholdPx ?? CHAT_LOAD_OLDER_TOP_PX);
}
