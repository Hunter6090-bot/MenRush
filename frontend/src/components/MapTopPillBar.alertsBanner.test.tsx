/**
 * QC on #392: pills only remeasured when the banner value changed, so a late
 * Quiet map? Start Pulse card left them ~153px too low. Banner also covered
 * Pulse buttons, and the Don't show again tick was a 24px target.
 *
 * Geometry is mocked with positions measured at 390px and 360px. ResizeObserver
 * is stubbed so a late Pulse (map panel moves) retriggers clearance.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapTopPillBar } from './MapTopPillBar';
import { MapEmptyRadius } from './MapEmptyRadius';
import { PushAlertBanner } from './PushAlertBanner';
import { useAuthStore } from '../hooks/store';
import { resetPromptPrefsSyncForTests } from '../lib/promptDismissal';
import { resetPromptSlotsForTests } from '../lib/promptSlot';
import { ClearTopPrompt } from './ClearTopPrompt';
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

const phones = [
  { width: 390, bannerTop: 60, bannerHeight: 142, mapTop: 116 },
  { width: 360, bannerTop: 60, bannerHeight: 142, mapTop: 116 },
];

const PILL_ROW_PADDING_PX = 12;
const PULSE_CARD_HEIGHT = 153;
const MAP_HEIGHT = 560;
const PILL_ROW_HEIGHT = 44;
const MAP_SPOTS_HEIGHT = 72;
const EMPTY_HEIGHT = 124;
const EMPTY_BOTTOM_PAD = 96;
const TICK_PX = 44;

const realRect = Element.prototype.getBoundingClientRect;
const roCallbacks = new Set<ResizeObserverCallback>();

function boxFor(width: number, top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: width,
    width,
    x: 0,
    y: top,
    toJSON() {},
  } as DOMRect;
}

function overlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

type LayoutState = {
  width: number;
  bannerTop: number;
  bannerHeight: number;
  mapTop: number;
  pulse: boolean;
  banner: boolean;
};

function mockLayout(state: LayoutState) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: state.width });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const id = this.getAttribute('data-testid');
    const pulsePad = state.pulse && state.banner
      ? offsetBelowTopPrompt(state.mapTop, state.bannerTop + state.bannerHeight)
      : 0;
    const mapTop = state.pulse ? state.mapTop + pulsePad + PULSE_CARD_HEIGHT : state.mapTop;

    if (id === 'push-alert-banner') {
      return state.banner ? boxFor(state.width, state.bannerTop, state.bannerHeight) : boxFor(state.width, 0, 0);
    }
    if (id === 'pulse-nudge-clearance') {
      return boxFor(state.width, state.mapTop, pulsePad + PULSE_CARD_HEIGHT);
    }
    if (id === 'pulse-nudge') {
      return boxFor(state.width, state.mapTop + pulsePad, PULSE_CARD_HEIGHT);
    }
    if (id === 'discover-map-panel' || id === 'map-overlay-column') {
      return boxFor(state.width, mapTop, MAP_HEIGHT);
    }
    if (id === 'map-top-stack') {
      const bannerBottom = state.banner ? state.bannerTop + state.bannerHeight : null;
      const offset = offsetBelowTopPrompt(mapTop, bannerBottom);
      return boxFor(state.width, mapTop, PILL_ROW_PADDING_PX + offset + PILL_ROW_HEIGHT + 8 + MAP_SPOTS_HEIGHT);
    }
    if (id === 'map-top-pill-bar') {
      const bannerBottom = state.banner ? state.bannerTop + state.bannerHeight : null;
      const offset = offsetBelowTopPrompt(mapTop, bannerBottom);
      return boxFor(state.width, mapTop + PILL_ROW_PADDING_PX + offset, PILL_ROW_HEIGHT);
    }
    if (id === 'map-privacy-note' || id === 'hotspots-map-helper') {
      const bannerBottom = state.banner ? state.bannerTop + state.bannerHeight : null;
      const offset = offsetBelowTopPrompt(mapTop, bannerBottom);
      const top = mapTop + PILL_ROW_PADDING_PX + offset + PILL_ROW_HEIGHT + 8;
      return boxFor(state.width, top, MAP_SPOTS_HEIGHT);
    }
    if (id === 'map-empty-radius') {
      return boxFor(state.width, mapTop + MAP_HEIGHT - EMPTY_BOTTOM_PAD - EMPTY_HEIGHT, EMPTY_HEIGHT);
    }
    if (id === 'alerts-prompt-never') {
      return boxFor(TICK_PX, state.bannerTop + 80, TICK_PX);
    }
    return realRect.call(this);
  });
}

async function settle() {
  await act(async () => {
    roCallbacks.forEach((cb) => cb([] as never, {} as ResizeObserver));
    await new Promise((r) => setTimeout(r, 0));
  });
}

function QuietPulseCard() {
  return (
    <ClearTopPrompt testId="pulse-nudge-clearance">
      <div data-testid="pulse-nudge" role="status">
        <p>Quiet map? Start Pulse</p>
        <button type="button" data-testid="pulse-nudge-start">
          Start Pulse
        </button>
        <button type="button" data-testid="pulse-nudge-dismiss">
          Not now
        </button>
      </div>
    </ClearTopPrompt>
  );
}

function renderNearby(opts: { pulse?: boolean } = {}) {
  return render(
    <>
      <PushAlertBanner />
      {opts.pulse ? <QuietPulseCard /> : null}
      <div className="relative" data-testid="discover-map-panel">
        <MapTopPillBar
          radiusKm={5}
          onRadiusClick={vi.fn()}
          onFiltersClick={vi.fn()}
          footer={<MapEmptyRadius nextRadiusKm={10} onWiden={vi.fn()} />}
        >
          <p data-testid="map-privacy-note">Map spots include independent venues and outdoor locations.</p>
        </MapTopPillBar>
      </div>
    </>,
  );
}

function assertNoOverlap(ids: string[]) {
  const rects = ids.map((id) => {
    const el = screen.getByTestId(id);
    return { id, rect: el.getBoundingClientRect() };
  });
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      expect(
        overlap(rects[i].rect, rects[j].rect),
        `${rects[i].id} overlaps ${rects[j].id}`,
      ).toBe(false);
    }
  }
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPromptPrefsSyncForTests();
  resetPromptSlotsForTests();
  setTopPromptBottom(null);
  roCallbacks.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        roCallbacks.add(cb);
      }
      observe() {
        this.cb([] as never, this as unknown as ResizeObserver);
      }
      disconnect() {
        roCallbacks.delete(this.cb);
      }
      unobserve() {}
    },
  );
  useAuthStore.setState({ user: { id: 'member-a', name: 'Member' } as never, token: 't' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(phones)('Map overlays never overlap ($width px)', (p) => {
  it('moves the pills below the banner while it shows, and back when it closes', async () => {
    const layout: LayoutState = { ...p, pulse: false, banner: true };
    mockLayout(layout);
    const user = userEvent.setup();
    renderNearby();
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
    await settle();

    const stack = screen.getByTestId('map-top-stack');
    const bannerBottom = p.bannerTop + p.bannerHeight;
    const expected = bannerBottom + TOP_PROMPT_GAP_PX - p.mapTop;
    expect(stack.getAttribute('data-offset-for-banner')).toBe(String(expected));
    expect(stack.style.paddingTop).toBe(`${PILL_ROW_PADDING_PX + expected}px`);
    const pillsTop = p.mapTop + expected + PILL_ROW_PADDING_PX;
    expect(pillsTop).toBeGreaterThan(bannerBottom);
    expect(screen.getByTestId('map-pill-radius')).toBeEnabled();
    expect(screen.getByTestId('map-pill-filters')).toBeEnabled();
    assertNoOverlap(['push-alert-banner', 'map-top-pill-bar', 'map-privacy-note', 'map-empty-radius']);

    layout.banner = false;
    await user.click(screen.getByTestId('alerts-prompt-close'));
    await settle();
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    expect(stack.style.paddingTop).toBe('');
    expect(stack.getAttribute('data-offset-for-banner')).toBe('0');
  });

  it('follows a late-loading Pulse card and keeps every overlay clear', async () => {
    const layout: LayoutState = { ...p, pulse: false, banner: true };
    mockLayout(layout);
    const user = userEvent.setup();
    const view = renderNearby({ pulse: false });
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
    await settle();

    const beforePulse = Number(screen.getByTestId('map-top-stack').getAttribute('data-offset-for-banner'));
    expect(beforePulse).toBeGreaterThan(0);

    layout.pulse = true;
    view.rerender(
      <>
        <PushAlertBanner />
        <QuietPulseCard />
        <div className="relative" data-testid="discover-map-panel">
          <MapTopPillBar
            radiusKm={5}
            onRadiusClick={vi.fn()}
            onFiltersClick={vi.fn()}
            footer={<MapEmptyRadius nextRadiusKm={10} onWiden={vi.fn()} />}
          >
            <p data-testid="map-privacy-note">Map spots include independent venues and outdoor locations.</p>
          </MapTopPillBar>
        </div>
      </>,
    );
    await settle();

    const pulse = screen.getByTestId('pulse-nudge');
    const clearance = screen.getByTestId('pulse-nudge-clearance');
    const banner = screen.getByTestId('push-alert-banner').getBoundingClientRect();
    expect(clearance.getAttribute('data-offset-for-banner')).not.toBe('0');
    expect(pulse.getBoundingClientRect().top).toBeGreaterThanOrEqual(banner.bottom);

    // Map has been pushed below the banner, so the pills no longer need a leftover offset.
    expect(screen.getByTestId('map-top-stack').getAttribute('data-offset-for-banner')).toBe('0');
    assertNoOverlap([
      'push-alert-banner',
      'pulse-nudge',
      'map-top-pill-bar',
      'map-privacy-note',
      'map-empty-radius',
    ]);

    layout.banner = false;
    await user.click(screen.getByTestId('alerts-prompt-close'));
    await settle();
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    expect(screen.getByTestId('map-top-stack').getAttribute('data-offset-for-banner')).toBe('0');
    expect(screen.getByTestId('pulse-nudge-clearance').getAttribute('data-offset-for-banner')).toBe('0');
    assertNoOverlap(['pulse-nudge', 'map-top-pill-bar', 'map-privacy-note', 'map-empty-radius']);
  });

  it("Don't show again tick is at least 44px", async () => {
    mockLayout({ ...p, pulse: false, banner: true });
    renderNearby();
    const tick = await screen.findByTestId('alerts-prompt-never');
    expect(tick.className).toMatch(/min-h-\[44px\]/);
    expect(tick.className).toMatch(/min-w-\[44px\]/);
    expect(tick.className).toMatch(/h-11/);
    expect(tick.className).toMatch(/w-11/);
    const rect = tick.getBoundingClientRect();
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.width).toBeGreaterThanOrEqual(44);
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
