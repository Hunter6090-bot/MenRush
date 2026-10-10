/**
 * QC P2 on #357: the floating alerts banner (z-40) covered the map's Radius
 * and Filters pills until it was closed. While it is on screen the pills move
 * below it; once it closes they go back. jsdom has no layout, so geometry is
 * mocked with the positions measured in a real browser at 390px and 360px.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapTopPillBar } from './MapTopPillBar';
import { PushAlertBanner } from './PushAlertBanner';
import { useAuthStore } from '../hooks/store';
import { resetPromptPrefsSyncForTests } from '../lib/promptDismissal';
import { resetPromptSlotsForTests } from '../lib/promptSlot';
import { offsetBelowTopPrompt, setTopPromptBottom, TOP_PROMPT_GAP_PX } from '../lib/topPromptOverlay';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    promptPrefsAPI: {
      get: vi.fn().mockResolvedValue({ data: { never: [] } }),
      setNever: vi.fn().mockResolvedValue({ data: { never: [] } }),
    },
  };
});

vi.mock('../lib/push', () => ({
  enablePushNotifications: vi.fn().mockResolvedValue('default'),
  getPushSupport: vi.fn(() => 'default'),
  iosNeedsHomeScreenForPush: vi.fn(() => false),
  isPushConfigured: vi.fn().mockResolvedValue(true),
  isStandalonePwa: vi.fn(() => false),
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Layout below the 52px mobile header, per phone width. Banner and map panel
 * positions measured in headless Chromium (Layout shell + Discover map panel,
 * light and dark): the banner card runs 60 to 202px at both widths (Turn on
 * sits on its own row), and the pills then sit about 20px below it.
 */
const phones = [
  { width: 390, bannerTop: 60, bannerHeight: 142, mapTop: 116 },
  { width: 360, bannerTop: 60, bannerHeight: 142, mapTop: 116 },
];

const PILL_ROW_PADDING_PX = 12; // pt-3 inside the stack
const realRect = Element.prototype.getBoundingClientRect;

function mockLayout(p: (typeof phones)[number]) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: p.width });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const id = this.getAttribute('data-testid');
    const box = (top: number, height: number) =>
      ({ top, bottom: top + height, height, left: 0, right: p.width, width: p.width, x: 0, y: top, toJSON() {} }) as DOMRect;
    if (id === 'push-alert-banner') return box(p.bannerTop, p.bannerHeight);
    if (id === 'discover-map-panel') return box(p.mapTop, 400);
    return realRect.call(this);
  });
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function renderNearby() {
  return render(
    <>
      <PushAlertBanner />
      <div className="relative" data-testid="discover-map-panel">
        <MapTopPillBar radiusKm={5} onRadiusClick={vi.fn()} onFiltersClick={vi.fn()} />
      </div>
    </>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPromptPrefsSyncForTests();
  resetPromptSlotsForTests();
  setTopPromptBottom(null);
  useAuthStore.setState({ user: { id: 'member-a', name: 'Member' } as never, token: 't' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(phones)('Map Radius and Filters stay clear of the alerts banner ($width px)', (p) => {
  it('moves the pills below the banner while it shows, and back when it closes', async () => {
    mockLayout(p);
    const user = userEvent.setup();
    renderNearby();
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
    await settle();

    const stack = screen.getByTestId('map-top-stack');
    const bannerBottom = p.bannerTop + p.bannerHeight;
    const expected = bannerBottom + TOP_PROMPT_GAP_PX - p.mapTop;
    expect(stack.style.top).toBe(`${expected}px`);
    // The pills' top edge sits below the banner's bottom edge: visible and tappable.
    const pillsTop = p.mapTop + expected + PILL_ROW_PADDING_PX;
    expect(pillsTop).toBeGreaterThan(bannerBottom);
    expect(screen.getByTestId('map-pill-radius')).toBeEnabled();
    expect(screen.getByTestId('map-pill-filters')).toBeEnabled();

    await user.click(screen.getByTestId('alerts-prompt-close'));
    await settle();
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    expect(stack.style.top).toBe('');
    expect(stack.getAttribute('data-offset-for-banner')).toBe('0');
  });
});

describe('offsetBelowTopPrompt', () => {
  it('is 0 with no banner or a banner that ends above the controls', () => {
    expect(offsetBelowTopPrompt(116, null)).toBe(0);
    expect(offsetBelowTopPrompt(300, 164)).toBe(0);
  });
  it('clears the banner by the gap', () => {
    expect(offsetBelowTopPrompt(116, 164)).toBe(164 + TOP_PROMPT_GAP_PX - 116);
  });
});
