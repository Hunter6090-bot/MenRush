import { describe, expect, it } from 'vitest';
import {
  CHAT_LOAD_OLDER_TOP_PX,
  CHAT_NEAR_BOTTOM_PX,
  distanceFromBottom,
  isNearBottom,
  restoreScrollAfterPrepend,
  shouldLoadOlderOnScroll,
  shouldStickToBottomOnUpdate,
} from './chatScroll';

function box(partial: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}) {
  return { ...partial };
}

describe('chatScroll sticky-bottom', () => {
  it('treats the tip as near-bottom within the threshold', () => {
    const el = box({ scrollTop: 900, scrollHeight: 1000, clientHeight: 80 });
    expect(distanceFromBottom(el)).toBe(20);
    expect(isNearBottom(el)).toBe(true);
    expect(shouldStickToBottomOnUpdate(el)).toBe(true);
  });

  it('does not stick when the user has scrolled mid-history', () => {
    const el = box({ scrollTop: 200, scrollHeight: 2000, clientHeight: 600 });
    expect(distanceFromBottom(el)).toBe(1200);
    expect(isNearBottom(el, CHAT_NEAR_BOTTOM_PX)).toBe(false);
    expect(shouldStickToBottomOnUpdate(el)).toBe(false);
  });

  it('force-sticks after the local user sends even when scrolled up', () => {
    const el = box({ scrollTop: 0, scrollHeight: 2000, clientHeight: 600 });
    expect(shouldStickToBottomOnUpdate(el, { force: true })).toBe(true);
  });

  it('defaults to stick when the scroller is not mounted yet', () => {
    expect(shouldStickToBottomOnUpdate(null)).toBe(true);
  });
});

describe('chatScroll load-older preserve', () => {
  it('asks for an older page only near the top while hasMore', () => {
    expect(
      shouldLoadOlderOnScroll(box({ scrollTop: 10, scrollHeight: 2000, clientHeight: 600 }), {
        hasMore: true,
      }),
    ).toBe(true);
    expect(
      shouldLoadOlderOnScroll(
        box({ scrollTop: CHAT_LOAD_OLDER_TOP_PX + 1, scrollHeight: 2000, clientHeight: 600 }),
        { hasMore: true },
      ),
    ).toBe(false);
    expect(
      shouldLoadOlderOnScroll(box({ scrollTop: 0, scrollHeight: 2000, clientHeight: 600 }), {
        loading: true,
        hasMore: true,
      }),
    ).toBe(false);
    expect(
      shouldLoadOlderOnScroll(box({ scrollTop: 0, scrollHeight: 2000, clientHeight: 600 }), {
        hasMore: false,
      }),
    ).toBe(false);
  });

  it('restores scrollTop by the prepended height delta', () => {
    const el = { scrollTop: 40, scrollHeight: 1400 };
    const nextTop = restoreScrollAfterPrepend(el, 1000);
    expect(nextTop).toBe(440);
    expect(el.scrollTop).toBe(440);
  });

  it('no-ops when height did not grow', () => {
    const el = { scrollTop: 120, scrollHeight: 800 };
    expect(restoreScrollAfterPrepend(el, 800)).toBe(120);
    expect(el.scrollTop).toBe(120);
  });
});
