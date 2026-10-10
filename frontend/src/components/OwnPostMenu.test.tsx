import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MENU_VIEWPORT_MARGIN, OwnPostMenu, placeMenu } from './OwnPostMenu';

const MENU = { width: 160, height: 96 };

// Trigger positions QC measured at 80e3a5f: own map post in the dock (left side)
// and own Community post (right side).
const triggers = (vw: number) => ({
  mapDock: { left: 34, right: 78, top: 480, bottom: 524 },
  community: { left: vw - 73, right: vw - 29, top: 300, bottom: 344 },
  farLeft: { left: 0, right: 44, top: 300, bottom: 344 },
  farRight: { left: vw - 44, right: vw, top: 300, bottom: 344 },
  nearBottom: { left: 34, right: 78, top: 780, bottom: 824 },
});

describe.each([390, 360])('placeMenu at %ipx', (vw) => {
  const vh = 844;
  for (const [name, t] of Object.entries(triggers(vw))) {
    it(`${name}: menu stays inside the viewport with an 8px margin`, () => {
      const p = placeMenu(t, MENU, { width: vw, height: vh });
      expect(p.left).toBeGreaterThanOrEqual(MENU_VIEWPORT_MARGIN);
      expect(p.left + MENU.width).toBeLessThanOrEqual(vw - MENU_VIEWPORT_MARGIN);
      expect(p.top).toBeGreaterThanOrEqual(MENU_VIEWPORT_MARGIN);
      expect(p.top + MENU.height).toBeLessThanOrEqual(vh - MENU_VIEWPORT_MARGIN);
    });
  }
  it('map dock trigger: anchors to the button left edge instead of opening off-screen', () => {
    expect(placeMenu(triggers(vw).mapDock, MENU, { width: vw, height: vh }).left).toBe(34);
  });
  it('community trigger: right-aligned to the button', () => {
    expect(placeMenu(triggers(vw).community, MENU, { width: vw, height: vh }).left).toBe(vw - 29 - 160);
  });
  it('flips above when there is no room below', () => {
    const t = triggers(vw).nearBottom;
    expect(placeMenu(t, MENU, { width: vw, height: vh }).top).toBe(t.top - 4 - MENU.height);
  });
});

describe('OwnPostMenu (••• on your own post)', () => {
  const origWidth = window.innerWidth;
  const origHeight = window.innerHeight;
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: origWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: origHeight });
  });

  it.each([390, 360])('rendered menu rect stays on screen at %ipx (map dock trigger)', async (vw) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: vw });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'menu') {
        const left = parseFloat(this.style.left) || 0;
        const top = parseFloat(this.style.top) || 0;
        return { left, top, right: left + 160, bottom: top + 96, width: 160, height: 96, x: left, y: top, toJSON: () => ({}) } as DOMRect;
      }
      return { left: 34, right: 78, top: 480, bottom: 524, width: 44, height: 44, x: 34, y: 480, toJSON: () => ({}) } as DOMRect;
    });
    const user = userEvent.setup();
    render(<OwnPostMenu tone="dark" testId="more" items={[{ label: 'Delete post', danger: true, testId: 'del', onSelect: vi.fn() }]} />);
    await user.click(screen.getByTestId('more'));
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body); // portalled, not trapped by the dock's backdrop-filter
    expect(menu.style.visibility).toBe('visible');
    const r = menu.getBoundingClientRect();
    expect(r.left).toBeGreaterThanOrEqual(8);
    expect(r.right).toBeLessThanOrEqual(vw - 8);
    // The row centre is on screen, so it can be read and tapped.
    expect(r.left + r.width / 2).toBeGreaterThan(0);
    expect(r.left + r.width / 2).toBeLessThan(vw);
  });

  it('44×44 trigger with a horizontal three-dot icon; 15px / 44px rows; Escape returns focus', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<OwnPostMenu testId="more" items={[{ label: 'Delete post', danger: true, testId: 'del', onSelect: onDelete }]} />);
    const trigger = screen.getByTestId('more');
    expect(trigger).toHaveClass('h-11', 'w-11');
    const svg = trigger.querySelector('svg')!;
    expect(svg.querySelectorAll('circle')).toHaveLength(3);
    expect(svg.querySelectorAll('rect')).toHaveLength(0); // not the 2×2 grid
    const cys = Array.from(svg.querySelectorAll('circle')).map((c) => c.getAttribute('cy'));
    expect(new Set(cys).size).toBe(1); // all on one row: horizontal
    expect(screen.queryByTestId('del')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('del')).toHaveClass('min-h-[44px]', 'text-[15px]');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('del')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Delete post' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
