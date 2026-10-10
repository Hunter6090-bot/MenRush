/**
 * QC on #392 / #405: pills follow the banner; Pulse floats on the map (does
 * not shrink it); buttons sit under the copy so the card stays short; nothing
 * interactive goes under the tab bar, PULSE FAB or chat dock. First paint uses
 * a layout-effect measure (no leftover offset / y606 jump).
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
import {
  offsetBelowTopPrompt,
  resetTopPromptOverlayForTests,
  TOP_PROMPT_GAP_PX,
} from '../lib/topPromptOverlay';
import { useState } from 'react';

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
const PULSE_CARD_HEIGHT = 128;
const DEFAULT_MAP_HEIGHT = 560;
const SHORT_MAP_HEIGHT = 400;
const PILL_ROW_HEIGHT = 44;
const MAP_SPOTS_HEIGHT = 72;
const EMPTY_HEIGHT = 124;
const EMPTY_BOTTOM_PAD = 112;
const NOTE_HEIGHT = 28;
const TICK_PX = 44;
const TAB_BAR_HEIGHT = 64;
const FAB_SIZE = 64;
const DOCK_SIZE = 44;
const VIEWPORT_HEIGHT = 844;

const realRect = Element.prototype.getBoundingClientRect;
const roCallbacks = new Set<ResizeObserverCallback>();

function boxFor(width: number, top: number, height: number, left = 0): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left,
    right: left + width,
    width,
    x: left,
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
  mapHeight: number;
  viewportHeight?: number;
};

function mapBottom(state: LayoutState): number {
  return state.mapTop + state.mapHeight;
}

function mockLayout(state: LayoutState) {
  const viewportHeight = state.viewportHeight ?? VIEWPORT_HEIGHT;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: state.width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewportHeight });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const id = this.getAttribute('data-testid');
    const bannerBottom = state.banner ? state.bannerTop + state.bannerHeight : null;
    const offset = offsetBelowTopPrompt(state.mapTop, bannerBottom);
    const stackTop = state.mapTop;
    const pulseTop = stackTop + PILL_ROW_PADDING_PX + offset;
    const pillsTop = state.pulse ? pulseTop + PULSE_CARD_HEIGHT + 8 : stackTop + PILL_ROW_PADDING_PX + offset;
    const spotsTop = pillsTop + PILL_ROW_HEIGHT + 8;
    const emptyTop = mapBottom(state) - EMPTY_BOTTOM_PAD - EMPTY_HEIGHT;
    const noteTop = emptyTop - NOTE_HEIGHT - 4;
    const clampTop = (top: number, height: number) => {
      const limit = mapBottom(state) - height;
      return Math.min(Math.max(top, state.mapTop), limit);
    };

    if (id === 'push-alert-banner') {
      return state.banner ? boxFor(state.width, state.bannerTop, state.bannerHeight) : boxFor(state.width, 0, 0);
    }
    if (id === 'pulse-nudge' || id === 'map-top-stack-leading') {
      const clipTop = state.mapTop;
      const clipBottom = noteTop;
      const visibleTop = Math.max(pulseTop, clipTop);
      const visibleBottom = Math.min(pulseTop + PULSE_CARD_HEIGHT, clipBottom);
      if (visibleBottom <= visibleTop) {
        return boxFor(state.width - 24, clipTop, 0);
      }
      return boxFor(state.width - 24, visibleTop, visibleBottom - visibleTop);
    }
    if (id === 'pulse-nudge-start' || id === 'pulse-nudge-dismiss') {
      const top = Math.min(pulseTop + PULSE_CARD_HEIGHT - 44, noteTop - 44);
      return boxFor(120, clampTop(top, 44), 44);
    }
    if (id === 'discover-map-panel' || id === 'map-overlay-column') {
      return boxFor(state.width, state.mapTop, state.mapHeight);
    }
    if (id === 'map-top-stack') {
      const height = PILL_ROW_PADDING_PX + offset + (state.pulse ? PULSE_CARD_HEIGHT + 8 : 0) + PILL_ROW_HEIGHT + 8 + MAP_SPOTS_HEIGHT;
      return boxFor(state.width, stackTop, height);
    }
    if (id === 'map-top-pill-bar' || id === 'map-pill-radius' || id === 'map-pill-filters') {
      return boxFor(id === 'map-top-pill-bar' ? state.width : 140, clampTop(pillsTop, PILL_ROW_HEIGHT), PILL_ROW_HEIGHT);
    }
    if (id === 'map-privacy-note') {
      return boxFor(state.width - 48, noteTop, NOTE_HEIGHT);
    }
    if (id === 'hotspots-map-helper') {
      return boxFor(state.width - 32, spotsTop, MAP_SPOTS_HEIGHT);
    }
    if (id === 'map-overlay-pinned') {
      return boxFor(state.width, noteTop, mapBottom(state) - EMPTY_BOTTOM_PAD - noteTop);
    }
    if (id === 'map-overlay-top') {
      return boxFor(state.width, state.mapTop, Math.max(0, noteTop - state.mapTop));
    }
    if (id === 'mapbox-locate') {
      return boxFor(40, mapBottom(state) - 56, 40, state.width - 56);
    }
    if (id === 'map-empty-radius' || id === 'map-widen-radius') {
      const top = id === 'map-widen-radius' ? emptyTop + EMPTY_HEIGHT - 44 : emptyTop;
      const height = id === 'map-widen-radius' ? 44 : EMPTY_HEIGHT;
      return boxFor(state.width - 32, clampTop(top, height), height);
    }
    if (id === 'alerts-prompt-never') {
      return boxFor(TICK_PX, state.bannerTop + 80, TICK_PX);
    }
    if (id === 'mobile-tab-bar') {
      return boxFor(state.width, viewportHeight - TAB_BAR_HEIGHT, TAB_BAR_HEIGHT);
    }
    if (id === 'pulse-fab') {
      return boxFor(FAB_SIZE, viewportHeight - 104 - FAB_SIZE, FAB_SIZE, state.width - 16 - FAB_SIZE);
    }
    if (id === 'discover-chat-dock-toggle') {
      return boxFor(DOCK_SIZE, mapBottom(state) - 48 - DOCK_SIZE, DOCK_SIZE, 12);
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
    <div data-testid="pulse-nudge" role="status">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <p>Quiet map? Start Pulse</p>
          <p>Seen first for 90 minutes.</p>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="pulse-nudge-actions">
          <button type="button" data-testid="pulse-nudge-start">
            Start Pulse
          </button>
          <button type="button" data-testid="pulse-nudge-dismiss">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomChrome() {
  return (
    <>
      <nav data-testid="mobile-tab-bar" />
      <button type="button" data-testid="pulse-fab">
        Pulse
      </button>
      <button type="button" data-testid="discover-chat-dock-toggle">
        Chat
      </button>
      <button type="button" data-testid="mapbox-locate">
        Locate
      </button>
    </>
  );
}

function renderNearby(opts: { pulse?: boolean } = {}) {
  return render(
    <>
      <PushAlertBanner />
      <div className="relative" data-testid="discover-map-panel">
        <MapTopPillBar
          radiusKm={5}
          onRadiusClick={vi.fn()}
          onFiltersClick={vi.fn()}
          leading={opts.pulse ? <QuietPulseCard /> : null}
          notes={<p data-testid="map-privacy-note">Your pin is moved 80 to 320 m</p>}
          footer={<MapEmptyRadius nextRadiusKm={10} onWiden={vi.fn()} />}
        >
          <p data-testid="hotspots-map-helper">Map spots include independent venues and outdoor locations.</p>
        </MapTopPillBar>
      </div>
      <BottomChrome />
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

function assertAboveBottomChrome(interactiveIds: string[]) {
  const tab = screen.getByTestId('mobile-tab-bar').getBoundingClientRect();
  const fab = screen.getByTestId('pulse-fab').getBoundingClientRect();
  const dock = screen.getByTestId('discover-chat-dock-toggle').getBoundingClientRect();
  const map = screen.getByTestId('discover-map-panel').getBoundingClientRect();
  const column = screen.getByTestId('map-overlay-column').getBoundingClientRect();
  expect(column.bottom).toBeLessThanOrEqual(map.bottom);
  for (const id of interactiveIds) {
    const rect = screen.getByTestId(id).getBoundingClientRect();
    expect(rect.bottom, `${id} under the map`).toBeLessThanOrEqual(map.bottom);
    expect(rect.bottom, `${id} under the tab bar`).toBeLessThanOrEqual(tab.top);
    expect(overlap(rect, fab), `${id} under PULSE`).toBe(false);
    expect(overlap(rect, dock), `${id} under the chat dock`).toBe(false);
  }
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPromptPrefsSyncForTests();
  resetPromptSlotsForTests();
  resetTopPromptOverlayForTests();
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
    const layout: LayoutState = { ...p, pulse: false, banner: true, mapHeight: DEFAULT_MAP_HEIGHT };
    mockLayout(layout);
    const user = userEvent.setup();
    renderNearby();
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();

    const stack = screen.getByTestId('map-top-stack');
    const bannerBottom = p.bannerTop + p.bannerHeight;
    const expected = bannerBottom + TOP_PROMPT_GAP_PX - p.mapTop;
    expect(stack.getAttribute('data-offset-for-banner')).toBe(String(expected));
    expect(stack.style.paddingTop).toBe(`${PILL_ROW_PADDING_PX + expected}px`);
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('true');
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

  it('follows a late-loading Pulse card on the map without pushing the panel down', async () => {
    const layout: LayoutState = { ...p, pulse: false, banner: true, mapHeight: DEFAULT_MAP_HEIGHT };
    mockLayout(layout);
    const user = userEvent.setup();
    const view = renderNearby({ pulse: false });
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();

    const beforePulse = Number(screen.getByTestId('map-top-stack').getAttribute('data-offset-for-banner'));
    expect(beforePulse).toBeGreaterThan(0);
    const mapTopBefore = screen.getByTestId('discover-map-panel').getBoundingClientRect().top;

    layout.pulse = true;
    view.rerender(
      <>
        <PushAlertBanner />
        <div className="relative" data-testid="discover-map-panel">
          <MapTopPillBar
            radiusKm={5}
            onRadiusClick={vi.fn()}
            onFiltersClick={vi.fn()}
            leading={<QuietPulseCard />}
            notes={<p data-testid="map-privacy-note">Your pin is moved 80 to 320 m</p>}
            footer={<MapEmptyRadius nextRadiusKm={10} onWiden={vi.fn()} />}
          >
            <p data-testid="hotspots-map-helper">Map spots include independent venues and outdoor locations.</p>
          </MapTopPillBar>
        </div>
        <BottomChrome />
      </>,
    );

    const pulse = screen.getByTestId('pulse-nudge');
    const banner = screen.getByTestId('push-alert-banner').getBoundingClientRect();
    expect(pulse.getBoundingClientRect().top).toBeGreaterThanOrEqual(banner.bottom);
    expect(screen.getByTestId('discover-map-panel').getBoundingClientRect().top).toBe(mapTopBefore);
    expect(screen.getByTestId('map-top-stack').getAttribute('data-offset-for-banner')).toBe(String(beforePulse));
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
    assertNoOverlap(['pulse-nudge', 'map-top-pill-bar', 'map-privacy-note', 'map-empty-radius']);
  });

  it('stacks Pulse buttons under the copy so the text keeps the full width', async () => {
    mockLayout({ ...p, pulse: true, banner: true, mapHeight: DEFAULT_MAP_HEIGHT });
    renderNearby({ pulse: true });
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
    const actions = screen.getByTestId('pulse-nudge-actions');
    expect(actions.className).toMatch(/flex-wrap/);
    expect(actions.parentElement?.className).toMatch(/flex-col/);
    expect(actions.parentElement?.className).not.toMatch(/justify-between/);
  });

  it("Don't show again tick is at least 44px", async () => {
    mockLayout({ ...p, pulse: false, banner: true, mapHeight: DEFAULT_MAP_HEIGHT });
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

describe('overlay column taller than the map (360 px, banner on)', () => {
  it('keeps interactive controls inside the map, above the tab bar, PULSE and the dock', async () => {
    const layout: LayoutState = {
      width: 360,
      bannerTop: 60,
      bannerHeight: 142,
      mapTop: 116,
      pulse: true,
      banner: true,
      mapHeight: SHORT_MAP_HEIGHT,
    };
    mockLayout(layout);
    renderNearby({ pulse: true });
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();

    const column = screen.getByTestId('map-overlay-column');
    const map = screen.getByTestId('discover-map-panel').getBoundingClientRect();
    const tab = screen.getByTestId('mobile-tab-bar').getBoundingClientRect();
    expect(screen.getByTestId('map-overlay-top').className).toMatch(/overflow-y-auto/);
    expect(column.className).toMatch(/overflow-hidden/);
    expect(column.getBoundingClientRect().height).toBe(SHORT_MAP_HEIGHT);
    expect(column.getBoundingClientRect().bottom).toBeLessThanOrEqual(map.bottom);
    expect(column.getBoundingClientRect().bottom).toBeLessThanOrEqual(tab.top);
    expect(column.getBoundingClientRect().height).toBeLessThan(
      PILL_ROW_PADDING_PX + 94 + PULSE_CARD_HEIGHT + PILL_ROW_HEIGHT + MAP_SPOTS_HEIGHT + EMPTY_HEIGHT + EMPTY_BOTTOM_PAD,
    );
    expect(column.contains(screen.getByTestId('map-widen-radius'))).toBe(true);
    expect(column.contains(screen.getByTestId('map-empty-radius'))).toBe(true);
    expect(column.contains(screen.getByTestId('pulse-nudge-start'))).toBe(true);

    assertAboveBottomChrome([
      'pulse-nudge-start',
      'pulse-nudge-dismiss',
      'map-pill-radius',
      'map-pill-filters',
      'map-widen-radius',
    ]);
    assertNoOverlap(['push-alert-banner', 'pulse-nudge', 'map-top-pill-bar', 'map-privacy-note']);
  });
});

describe('first paint has no leftover offset jump', () => {
  it('measures in the layout effect so the first committed offset is already correct', async () => {
    const p = phones[0];
    mockLayout({ ...p, pulse: true, banner: true, mapHeight: DEFAULT_MAP_HEIGHT });
    renderNearby({ pulse: true });
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
    const expected = p.bannerTop + p.bannerHeight + TOP_PROMPT_GAP_PX - p.mapTop;
    const stack = screen.getByTestId('map-top-stack');
    expect(stack.getAttribute('data-offset-for-banner')).toBe(String(expected));
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('true');
    const pillsTop = screen.getByTestId('map-top-pill-bar').getBoundingClientRect().top;
    expect(pillsTop).toBeLessThan(400);
    expect(pillsTop).toBeGreaterThan(p.bannerTop + p.bannerHeight);
  });
});

function pointIn(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
}

function mockElementFromPoint() {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    writable: true,
    value: (x: number, y: number) => {
    const blockers = ['mobile-tab-bar', 'pulse-fab', 'discover-chat-dock-toggle', 'mapbox-locate'];
    for (const id of blockers) {
      const el = screen.queryByTestId(id);
      if (el && pointIn(x, y, el.getBoundingClientRect())) return el;
    }
    const widen = screen.queryByTestId('map-widen-radius');
    if (widen && pointIn(x, y, widen.getBoundingClientRect())) return widen;
    return null;
    },
  });
}

function InteractiveQuietMap({
  theme,
  pulse = true,
}: {
  theme: 'light' | 'dark';
  pulse?: boolean;
}) {
  const [radius, setRadius] = useState(5);
  return (
    <div data-theme={theme} data-testid="theme-root">
      <PushAlertBanner />
      <div className="relative" data-testid="discover-map-panel">
        <MapTopPillBar
          radiusKm={radius}
          onRadiusClick={vi.fn()}
          onFiltersClick={vi.fn()}
          leading={pulse ? <QuietPulseCard /> : null}
          notes={<p data-testid="map-privacy-note">Your pin is moved 80 to 320 m</p>}
          footer={
            <MapEmptyRadius
              nextRadiusKm={16}
              onWiden={() => setRadius(16)}
            />
          }
        />
      </div>
      <BottomChrome />
    </div>
  );
}

describe.each(['dark', 'light'] as const)('pinned Widen is tappable (%s)', (theme) => {
  describe.each(phones)('$width px', (p) => {
    it('keeps Widen fully above the tab bar, FAB and dock, and a tap changes the radius', async () => {
      mockLayout({ ...p, pulse: true, banner: true, mapHeight: DEFAULT_MAP_HEIGHT });
      mockElementFromPoint();
      const user = userEvent.setup();
      render(<InteractiveQuietMap theme={theme} />);
      expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();

      const widen = screen.getByTestId('map-widen-radius');
      const box = widen.getBoundingClientRect();
      const tab = screen.getByTestId('mobile-tab-bar').getBoundingClientRect();
      const fab = screen.getByTestId('pulse-fab').getBoundingClientRect();
      const dock = screen.getByTestId('discover-chat-dock-toggle').getBoundingClientRect();
      expect(box.bottom).toBeLessThanOrEqual(tab.top);
      expect(box.bottom).toBeLessThanOrEqual(fab.top);
      expect(box.bottom).toBeLessThanOrEqual(dock.top);
      expect(overlap(box, tab)).toBe(false);
      expect(overlap(box, fab)).toBe(false);
      expect(overlap(box, dock)).toBe(false);

      const hit = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
      expect(hit, 'Widen centre is covered').toBe(widen);

      expect(screen.getByTestId('map-pill-radius')).toHaveTextContent(/5 miles/);
      await user.click(widen);
      expect(screen.getByTestId('map-pill-radius').textContent).not.toMatch(/5 miles/);
    });
  });
});

describe('landscape overlay clearance (844x390)', () => {
  it('keeps Pulse and Widen clear of locate, PULSE and the dock', async () => {
    const layout: LayoutState = {
      width: 844,
      bannerTop: 48,
      bannerHeight: 120,
      mapTop: 52,
      pulse: true,
      banner: true,
      mapHeight: 390 - 52 - 64,
      viewportHeight: 390,
    };
    mockLayout(layout);
    mockElementFromPoint();
    render(<InteractiveQuietMap theme="dark" />);
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();

    const pulse = screen.getByTestId('pulse-nudge').getBoundingClientRect();
    const top = screen.getByTestId('map-overlay-top').getBoundingClientRect();
    expect(pulse.bottom).toBeLessThanOrEqual(top.bottom + 1);
    assertAboveBottomChrome(['map-widen-radius']);
    const locate = screen.getByTestId('mapbox-locate').getBoundingClientRect();
    expect(overlap(screen.getByTestId('map-widen-radius').getBoundingClientRect(), locate)).toBe(false);
    expect(overlap(pulse, locate)).toBe(false);
    expect(overlap(pulse, screen.getByTestId('pulse-fab').getBoundingClientRect())).toBe(false);
    expect(overlap(pulse, screen.getByTestId('discover-chat-dock-toggle').getBoundingClientRect())).toBe(
      false,
    );
  });
});

describe('pills wait for the banner to settle', () => {
  it('does not paint pills at the un-offset y while the banner is still deciding', async () => {
    const p = phones[0];
    mockLayout({ ...p, pulse: true, banner: true, mapHeight: DEFAULT_MAP_HEIGHT });
    let release: (value: boolean) => void = () => {};
    const { isPushConfigured } = await import('../lib/push');
    vi.mocked(isPushConfigured).mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
    );
    renderNearby({ pulse: true });
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('false');
    expect(screen.getByTestId('map-overlay-top').style.visibility).toBe('hidden');

    await act(async () => {
      release(true);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('true');
    expect(screen.getByTestId('map-overlay-top').style.visibility).toBe('visible');
    const pillsTop = screen.getByTestId('map-top-pill-bar').getBoundingClientRect().top;
    expect(pillsTop).toBeGreaterThan(p.bannerTop + p.bannerHeight);
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
