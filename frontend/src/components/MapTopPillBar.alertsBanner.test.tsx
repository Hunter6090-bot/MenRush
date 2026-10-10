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
import { MapPrivacyNote } from './MapPrivacyNote';
import { PushAlertBanner } from './PushAlertBanner';
import { useAuthStore } from '../hooks/store';
import { resetPromptPrefsSyncForTests } from '../lib/promptDismissal';
import { resetPromptSlotsForTests } from '../lib/promptSlot';
import {
  MAP_OVERLAY_BOTTOM_CLEARANCE_CLASS,
  MAP_OVERLAY_PINNED_MAX_CLASS,
  offsetBelowTopPrompt,
  resetTopPromptOverlayForTests,
  TOP_PROMPT_GAP_PX,
  TOP_PROMPT_SETTLE_TIMEOUT_MS,
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
const EMPTY_HEIGHT = 48;
const EMPTY_BOTTOM_PAD = 116;
const LAYER_HEIGHT = 44;
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
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
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
    const pillsTop = stackTop + PILL_ROW_PADDING_PX + offset;
    const layersTop = pillsTop + PILL_ROW_HEIGHT + 8;
    const spotsTop = layersTop + LAYER_HEIGHT + 8;
    const pulseTop = state.pulse ? spotsTop + MAP_SPOTS_HEIGHT + 8 : spotsTop;
    const emptyTop = mapBottom(state) - EMPTY_BOTTOM_PAD - EMPTY_HEIGHT;
    const noteTop = Math.min(pulseTop + (state.pulse ? PULSE_CARD_HEIGHT + 8 : 0), emptyTop - NOTE_HEIGHT - 4);
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
    if (id === 'map-overlay-shift') {
      return boxFor(state.width, stackTop, offset);
    }
    if (id === 'map-top-stack') {
      return boxFor(state.width, stackTop + offset, PILL_ROW_PADDING_PX + PILL_ROW_HEIGHT);
    }
    if (id === 'map-top-pill-bar' || id === 'map-pill-radius' || id === 'map-pill-filters') {
      return boxFor(id === 'map-top-pill-bar' ? state.width : 140, clampTop(pillsTop, PILL_ROW_HEIGHT), PILL_ROW_HEIGHT);
    }
    if (id === 'map-layer-chrome' || id === 'layer-toggle-people' || id === 'layer-toggle-hotspots') {
      return boxFor(id === 'map-layer-chrome' ? 120 : 44, clampTop(layersTop, LAYER_HEIGHT), LAYER_HEIGHT, state.width - 140);
    }
    if (id === 'hotspots-map-helper-dismiss') {
      return boxFor(44, clampTop(spotsTop, 44), 44, state.width - 72);
    }
    if (id === 'map-privacy-note') {
      return boxFor(state.width - 48, noteTop, NOTE_HEIGHT);
    }
    if (id === 'hotspots-map-helper') {
      return boxFor(state.width - 32, spotsTop, MAP_SPOTS_HEIGHT);
    }
    if (id === 'map-overlay-pinned') {
      return boxFor(state.width, emptyTop, EMPTY_HEIGHT);
    }
    if (id === 'map-overlay-top') {
      return boxFor(state.width, state.mapTop, Math.max(44, emptyTop - state.mapTop));
    }
    if (id === 'map-overlay-scroll') {
      return boxFor(state.width, pillsTop + PILL_ROW_HEIGHT, Math.max(0, emptyTop - (pillsTop + PILL_ROW_HEIGHT)));
    }
    if (id === 'map-overlay-clearance') {
      return boxFor(state.width, mapBottom(state) - EMPTY_BOTTOM_PAD, EMPTY_BOTTOM_PAD);
    }
    if (id === 'mapbox-locate') {
      return boxFor(40, mapBottom(state) - 56, 40, state.width - 56);
    }
    if (id === 'map-empty-radius' || id === 'map-widen-radius') {
      const top = emptyTop;
      const height = 44;
      const width = Math.min(240, state.width - 120);
      const left = (state.width - width) / 2;
      return boxFor(id === 'map-widen-radius' ? 120 : width, clampTop(top, height), height, left);
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

function LayerAndSpotsNote() {
  return (
    <>
      <div data-testid="map-layer-chrome">
        <button type="button" data-testid="layer-toggle-people" className="min-h-[44px] min-w-[44px]">
          People
        </button>
        <button type="button" data-testid="layer-toggle-hotspots" className="min-h-[44px] min-w-[44px]">
          Spots
        </button>
      </div>
      <div data-testid="hotspots-map-helper">
        <p data-testid="hotspots-map-helper-copy">Map spots include independent venues and outdoor locations. 18+ only.</p>
        <button type="button" data-testid="hotspots-map-helper-dismiss" className="h-11 w-11 min-h-[44px] min-w-[44px]">
          ×
        </button>
      </div>
    </>
  );
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
          notes={<MapPrivacyNote text="Your pin is moved 80 to 320 m" />}
          footer={<MapEmptyRadius compact nextRadiusKm={10} onWiden={vi.fn()} />}
        >
          <LayerAndSpotsNote />
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
  vi.useRealTimers();
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
    const shift = screen.getByTestId('map-overlay-shift');
    expect(Number.parseFloat(shift.style.height)).toBe(expected);
    expect(shift.style.transition).toMatch(/transform/);
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
    expect(Number.parseFloat(screen.getByTestId('map-overlay-shift').style.height) || 0).toBe(0);
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
            notes={<MapPrivacyNote text="Your pin is moved 80 to 320 m" />}
            footer={<MapEmptyRadius compact nextRadiusKm={10} onWiden={vi.fn()} />}
          >
            <LayerAndSpotsNote />
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
    expect(screen.getByTestId('map-overlay-scroll').className).toMatch(/overflow-y-auto/);
    expect(column.className).toMatch(/overflow-hidden/);
    expect(screen.getByTestId('map-overlay-pinned').className).toMatch(/max-h-\[25%\]/);
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
      const overlay = [
        'push-alert-banner',
        'map-pill-radius',
        'map-pill-filters',
        'layer-toggle-people',
        'layer-toggle-hotspots',
        'hotspots-map-helper-dismiss',
        'map-privacy-note-close',
        'map-widen-radius',
      ];
      for (const id of overlay) {
        const el = screen.queryByTestId(id);
        if (el && pointIn(x, y, el.getBoundingClientRect())) return el;
      }
      const chrome = ['mapbox-locate', 'pulse-fab', 'discover-chat-dock-toggle', 'mobile-tab-bar'];
      for (const id of chrome) {
        const el = screen.queryByTestId(id);
        if (el && pointIn(x, y, el.getBoundingClientRect())) return el;
      }
      return null;
    },
  });
}

const TW_SPACE: Record<string, number> = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '11': 44,
};

function classSpace(cls: string, prefixes: string[]): number {
  let n = 0;
  for (const prefix of prefixes) {
    const arb = cls.match(new RegExp(`${prefix}-\\[(\\d+)px\\]`));
    if (arb) {
      n += Number(arb[1]);
      continue;
    }
    const tw = cls.match(new RegExp(`${prefix}-(\\d+(?:\\.\\d+)?)`));
    if (tw && TW_SPACE[tw[1]] != null) n += TW_SPACE[tw[1]];
  }
  return n;
}

function overlayPadBottom(el: Element): number {
  const cls = (el as HTMLElement).className || '';
  if (
    cls.includes(MAP_OVERLAY_BOTTOM_CLEARANCE_CLASS) ||
    cls.includes('h-[calc(var(--fab-size') ||
    cls.includes('pb-[calc(var(--fab-size')
  ) {
    return 64 + 16 + 36;
  }
  const clearance = el.querySelector?.('[data-testid="map-overlay-clearance"]');
  if (clearance) return overlayPadBottom(clearance);
  return classSpace(cls, ['pb', 'py', 'h']);
}

function estimateHeight(el: Element): number {
  const cls = (el as HTMLElement).className || '';
  if (el.getAttribute('data-testid') === 'map-widen-radius' || cls.includes('min-h-[44px]')) {
    return Math.max(44, classSpace(cls, ['pt', 'pb', 'py']) + 20);
  }
  const padY = classSpace(cls, ['pt', 'pb', 'py']);
  const kids = [...el.children];
  if (kids.length === 0) {
    const text = el.textContent?.trim();
    const textPx = Number((cls.match(/text-\[(\d+)px\]/) || [])[1] || 0);
    return padY + (text ? (textPx || 20) + 4 : 0);
  }
  let h = padY;
  for (const child of kids) {
    h += estimateHeight(child) + classSpace((child as HTMLElement).className || '', ['mt', 'mb', 'my']);
  }
  return h;
}

function parseStylePx(style: CSSStyleDeclaration, key: 'width' | 'height' | 'top' | 'left' | 'bottom' | 'right'): number | null {
  const raw = style[key];
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function viewportBox(): DOMRect {
  return boxFor(window.innerWidth, 0, window.innerHeight);
}

/**
 * Boxes come from the rendered tree: inline chrome geometry plus the overlay
 * column's real classes (inset-0, bottom clearance, pinned shrink-0). Not a
 * parallel invented y table.
 */
function installRenderedLayoutRects() {
  const memo = new WeakMap<Element, DOMRect>();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return measureRendered(this, memo);
  });
}

function measureRendered(el: Element, memo: WeakMap<Element, DOMRect>): DOMRect {
  const cached = memo.get(el);
  if (cached) return cached;

  const html = el as HTMLElement;
  const id = html.getAttribute('data-testid');
  const cls = html.className || '';
  const style = html.style;
  const pos = style.position;

  const parent = html.parentElement;
  const containing =
    pos === 'fixed'
      ? viewportBox()
      : parent
        ? measureRendered(parent, memo)
        : viewportBox();

  const width = parseStylePx(style, 'width');
  const height = parseStylePx(style, 'height');
  const top = parseStylePx(style, 'top');
  const left = parseStylePx(style, 'left');
  const bottom = parseStylePx(style, 'bottom');
  const right = parseStylePx(style, 'right');

  if (width != null || height != null || top != null || bottom != null || left != null || right != null) {
    const w = width ?? containing.width;
    let t = top;
    let h = height;
    let l = left ?? containing.left;
    if (t == null && bottom != null && h != null) t = containing.top + containing.height - bottom - h;
    if (t == null && bottom != null) {
      t = containing.top + (top ?? 0);
      h = containing.height - bottom - (top ?? 0);
    }
    if (left == null && right != null) l = containing.left + containing.width - right - w;
    if (t == null) t = containing.top;
    if (h == null) h = 0;
    const box = boxFor(w, t, h, l);
    memo.set(el, box);
    return box;
  }

  if (id === 'map-overlay-column' || (cls.includes('absolute') && cls.includes('inset-0'))) {
    memo.set(el, containing);
    return containing;
  }

  if (id === 'map-overlay-clearance') {
    const col = html.parentElement ?? html;
    const colBox = measureRendered(col, memo);
    const h = overlayPadBottom(html);
    const box = boxFor(colBox.width, colBox.bottom - h, h, colBox.left);
    memo.set(el, box);
    return box;
  }

  if (id === 'map-overlay-pinned') {
    const col = html.parentElement ?? html;
    const colBox = measureRendered(col, memo);
    const pad = overlayPadBottom(col);
    const natural = Math.max(44, estimateHeight(html));
    const h = Math.min(natural, Math.max(44, colBox.height * 0.25));
    const box = boxFor(colBox.width, colBox.bottom - pad - h, h, colBox.left);
    memo.set(el, box);
    return box;
  }

  if (id === 'map-overlay-shift') {
    const col = html.parentElement ?? html;
    const colBox = measureRendered(col, memo);
    const h = Number(html.getAttribute('data-offset-for-banner') || 0);
    const box = boxFor(colBox.width, colBox.top, h, colBox.left);
    memo.set(el, box);
    return box;
  }

  if (id === 'map-overlay-top') {
    const col = html.parentElement ?? html;
    const colBox = measureRendered(col, memo);
    const gap = col.querySelector('[data-testid="map-overlay-shift"]');
    const gapH = gap ? measureRendered(gap, memo).height : 0;
    const pinned = col.querySelector('[data-testid="map-overlay-pinned"]');
    const pinnedTop = pinned ? measureRendered(pinned, memo).top : colBox.bottom - overlayPadBottom(col);
    const box = boxFor(colBox.width, colBox.top + gapH, Math.max(44, pinnedTop - (colBox.top + gapH)), colBox.left);
    memo.set(el, box);
    return box;
  }

  if (id === 'map-top-stack' || id === 'map-top-pill-bar' || id === 'map-pill-radius' || id === 'map-pill-filters') {
    const top = html.closest('[data-testid="map-overlay-top"]') ?? html;
    const topBox = measureRendered(top, memo);
    const t = topBox.top + PILL_ROW_PADDING_PX;
    const w = id === 'map-top-pill-bar' || id === 'map-top-stack' ? topBox.width : 140;
    const left = id === 'map-pill-filters' ? topBox.left + topBox.width / 2 : topBox.left + 24;
    const box = boxFor(w, t, PILL_ROW_HEIGHT, id.startsWith('map-pill') ? left : topBox.left);
    memo.set(el, box);
    return box;
  }

  if (
    id === 'map-layer-chrome' ||
    id === 'layer-toggle-people' ||
    id === 'layer-toggle-hotspots' ||
    id === 'hotspots-map-helper' ||
    id === 'hotspots-map-helper-dismiss'
  ) {
    const top = html.closest('[data-testid="map-overlay-top"]') ?? html;
    const topBox = measureRendered(top, memo);
    const col = html.closest('[data-testid="map-overlay-column"]') ?? html;
    const pinned = col.querySelector('[data-testid="map-overlay-pinned"]');
    const pinnedTop = pinned ? measureRendered(pinned, memo).top : topBox.bottom;
    const t = Math.min(topBox.top + PILL_ROW_PADDING_PX + PILL_ROW_HEIGHT + 8, pinnedTop - 48);
    const size = id === 'hotspots-map-helper' ? 72 : 44;
    const left =
      id === 'hotspots-map-helper-dismiss'
        ? topBox.left + topBox.width - 56
        : id === 'layer-toggle-hotspots'
          ? topBox.left + topBox.width - 100
          : topBox.left + topBox.width - 148;
    const box = boxFor(id === 'hotspots-map-helper' || id === 'map-layer-chrome' ? 160 : 44, t, size, left);
    memo.set(el, box);
    return box;
  }

  if (id === 'map-privacy-note' || id === 'map-privacy-note-close') {
    const top = html.closest('[data-testid="map-overlay-top"]') ?? html;
    const topBox = measureRendered(top, memo);
    const col = html.closest('[data-testid="map-overlay-column"]') ?? html;
    const pinned = col.querySelector('[data-testid="map-overlay-pinned"]');
    const pinnedTop = pinned ? measureRendered(pinned, memo).top : topBox.bottom;
    const t = Math.max(topBox.top + 12 + 44, Math.min(topBox.top + 12 + 44 + 8 + 44 + 8, pinnedTop - 48));
    const box =
      id === 'map-privacy-note-close'
        ? boxFor(44, t, 44, topBox.left + 180)
        : boxFor(160, t, 44, topBox.left + 24);
    memo.set(el, box);
    return box;
  }

  if (id === 'map-empty-radius' || id === 'map-widen-radius') {
    const pinned = html.closest('[data-testid="map-overlay-pinned"]');
    const p = pinned
      ? measureRendered(pinned, memo)
      : boxFor(containing.width, containing.bottom - 60, 48, containing.left);
    const width = Math.min(240, Math.max(120, p.width - 120));
    const left = p.left + (p.width - width) / 2;
    const box =
      id === 'map-widen-radius'
        ? boxFor(120, p.top + 2, 44, left + width - 124)
        : boxFor(width, p.top + 2, 44, left);
    memo.set(el, box);
    return box;
  }

  const box = realRect.call(html);
  memo.set(el, box);
  return box;
}

function InteractiveQuietMap({
  theme,
  pulse = true,
  width = 360,
  height = 780,
  header = 56,
  tabHeight = 71,
  banner = true,
}: {
  theme: 'light' | 'dark';
  pulse?: boolean;
  width?: number;
  height?: number;
  header?: number;
  tabHeight?: number;
  banner?: boolean;
}) {
  const [radius, setRadius] = useState(5);
  return (
    <div
      data-theme={theme}
      data-testid="theme-root"
      style={{ position: 'relative', width, height, overflow: 'hidden' }}
    >
      {banner ? <PushAlertBanner /> : null}
      <div
        className="relative overflow-hidden"
        data-testid="discover-map-panel"
        style={{ position: 'absolute', top: header, left: 0, width, height: height - header - tabHeight }}
      >
        <MapTopPillBar
          radiusKm={radius}
          onRadiusClick={vi.fn()}
          onFiltersClick={vi.fn()}
          leading={pulse ? <QuietPulseCard /> : null}
          notes={<MapPrivacyNote text="Your pin is moved 80 to 320 m" />}
          footer={<MapEmptyRadius compact nextRadiusKm={16} onWiden={() => setRadius(16)} />}
        >
          <LayerAndSpotsNote />
        </MapTopPillBar>
        <button
          type="button"
          data-testid="discover-chat-dock-toggle"
          style={{ position: 'absolute', bottom: 48, left: 12, width: 44, height: 44 }}
        >
          Chat
        </button>
        <button
          type="button"
          data-testid="mapbox-locate"
          style={{ position: 'absolute', bottom: 56, right: 12, width: 40, height: 40 }}
        >
          Locate
        </button>
      </div>
      <nav
        data-testid="mobile-tab-bar"
        style={{ position: 'absolute', left: 0, bottom: 0, width, height: tabHeight }}
      />
      <button
        type="button"
        data-testid="pulse-fab"
        style={{ position: 'fixed', right: 16, bottom: 104, width: 64, height: 64 }}
      >
        Pulse
      </button>
    </div>
  );
}

function phoneFrame(width: number): { width: number; height: number } {
  return { width, height: width === 360 ? 780 : 844 };
}

describe.each(['dark', 'light'] as const)('pinned Widen is tappable (%s)', (theme) => {
  describe.each(phones)('$width px', (p) => {
    it('keeps Widen fully above the tab bar, FAB and dock, and a tap changes the radius', async () => {
      const frame = phoneFrame(p.width);
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: frame.width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: frame.height });
      installRenderedLayoutRects();
      mockElementFromPoint();
      const user = userEvent.setup();
      render(<InteractiveQuietMap theme={theme} width={frame.width} height={frame.height} />);
      expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();

      const widen = screen.getByTestId('map-widen-radius');
      const box = widen.getBoundingClientRect();
      const tab = screen.getByTestId('mobile-tab-bar').getBoundingClientRect();
      const fab = screen.getByTestId('pulse-fab').getBoundingClientRect();
      const dock = screen.getByTestId('discover-chat-dock-toggle').getBoundingClientRect();
      expect(box.height).toBeGreaterThanOrEqual(44);
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
  it('shows pills after the short timeout when the push check never returns', async () => {
    const p = phones[0];
    mockLayout({ ...p, pulse: true, banner: true, mapHeight: DEFAULT_MAP_HEIGHT });
    vi.useFakeTimers();
    const { isPushConfigured } = await import('../lib/push');
    vi.mocked(isPushConfigured).mockReturnValue(new Promise<boolean>(() => {}));
    renderNearby({ pulse: true });
    expect(screen.getByTestId('map-pill-radius')).toBeVisible();
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOP_PROMPT_SETTLE_TIMEOUT_MS);
    });
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('true');
    expect(screen.getByTestId('map-pill-radius')).toBeVisible();
    expect(screen.getByTestId('map-pill-filters')).toBeVisible();
    expect(screen.getByTestId('pulse-nudge')).toBeVisible();
  });

  it('shows pills right away when the push check fails', async () => {
    const p = phones[0];
    mockLayout({ ...p, pulse: true, banner: true, mapHeight: DEFAULT_MAP_HEIGHT });
    const { isPushConfigured } = await import('../lib/push');
    vi.mocked(isPushConfigured).mockRejectedValue(new Error('push setup failed'));
    renderNearby({ pulse: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('true');
    expect(screen.getByTestId('map-pill-radius')).toBeVisible();
    expect(screen.getByTestId('map-pill-filters')).toBeVisible();
    expect(screen.getByTestId('pulse-nudge')).toBeVisible();
  });

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
    expect(screen.getByTestId('map-pill-radius')).toBeVisible();
    expect(screen.getByTestId('map-overlay-shift').style.transition).toMatch(/transform/);

    await act(async () => {
      release(true);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
    expect(screen.getByTestId('map-overlay-column').getAttribute('data-overlay-ready')).toBe('true');
    const pillsTop = screen.getByTestId('map-top-pill-bar').getBoundingClientRect().top;
    expect(pillsTop).toBeGreaterThan(p.bannerTop + p.bannerHeight);
  });
});

const VIEWPORTS = [
  { width: 844, height: 390, header: 52, tabHeight: 64, name: '844x390' },
  { width: 640, height: 360, header: 48, tabHeight: 48, name: '640x360' },
  { width: 360, height: 640, header: 56, tabHeight: 64, name: '360x640' },
  { width: 360, height: 780, header: 56, tabHeight: 71, name: '360x780' },
  { width: 390, height: 844, header: 56, tabHeight: 71, name: '390x844' },
] as const;

function hitCentre(id: string): Element | null {
  const el = screen.getByTestId(id);
  const box = el.getBoundingClientRect();
  return document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
}

describe('360x640 banner and Pulse keep pills on screen', () => {
  it('puts Radius / Filters first and shows a fade when Pulse overflows', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    installRenderedLayoutRects();
    mockElementFromPoint();
    render(
      <InteractiveQuietMap
        theme="dark"
        pulse
        banner
        width={360}
        height={640}
        header={56}
        tabHeight={64}
      />,
    );
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();

    const pills = screen.getByTestId('map-top-pill-bar');
    const pulse = screen.getByTestId('map-top-stack-leading');
    const scroll = screen.getByTestId('map-overlay-scroll');
    expect(pills.compareDocumentPosition(pulse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pills.closest('[data-testid="map-overlay-scroll"]')).toBeNull();
    expect(scroll.contains(pulse)).toBe(true);
    expect(scroll.className).toMatch(/overflow-y-auto/);

    Object.defineProperty(scroll, 'scrollHeight', { configurable: true, value: 420 });
    Object.defineProperty(scroll, 'clientHeight', { configurable: true, value: 96 });
    Object.defineProperty(scroll, 'scrollTop', { configurable: true, value: 0 });
    await settle();
    expect(screen.getByTestId('map-overlay-scroll-cue')).toBeInTheDocument();
  });
});

describe.each(VIEWPORTS)('overlay hit targets $name', (vp) => {
  describe.each([true, false] as const)('banner %s', (bannerOn) => {
    it('keeps Radius, Filters, Widen, locate, layers and the note close tappable', async () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: vp.width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: vp.height });
      installRenderedLayoutRects();
      mockElementFromPoint();
      render(
        <InteractiveQuietMap
          theme="dark"
          pulse
          banner={bannerOn}
          width={vp.width}
          height={vp.height}
          header={vp.header}
          tabHeight={vp.tabHeight}
        />,
      );
      if (bannerOn) {
        expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
      }

      const top = screen.getByTestId('map-overlay-top').getBoundingClientRect();
      expect(top.height).toBeGreaterThanOrEqual(44);
      expect(screen.getByTestId('map-overlay-pinned').className).toContain(MAP_OVERLAY_PINNED_MAX_CLASS);

      const radius = screen.getByTestId('map-pill-radius').getBoundingClientRect();
      expect(radius.height).toBeGreaterThanOrEqual(44);
      expect(radius.bottom).toBeLessThanOrEqual(top.bottom + 1);

      const widen = screen.getByTestId('map-widen-radius').getBoundingClientRect();
      const locate = screen.getByTestId('mapbox-locate').getBoundingClientRect();
      expect(overlap(widen, locate)).toBe(false);

      for (const id of [
        'map-pill-radius',
        'map-pill-filters',
        'map-widen-radius',
        'mapbox-locate',
        'layer-toggle-people',
        'layer-toggle-hotspots',
        'hotspots-map-helper-dismiss',
        'map-privacy-note-close',
      ]) {
        expect(hitCentre(id), `${id} is covered`).toBe(screen.getByTestId(id));
      }
    });
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
