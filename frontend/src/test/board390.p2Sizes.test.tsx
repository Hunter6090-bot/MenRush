/** QC #390 P2s: 15px text and 44px targets on the badge, Men nearby, Get verified and Privacy. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationDot } from '../components/NotificationDot';
import { ProfileVerification } from '../components/ProfileVerification';

const read = (f: string) => readFileSync(resolve(__dirname, f), 'utf8');
const SMALL = /\btext-\[(9|10|11|12|13|14)px\]|(?<![\w-])text-(xs|sm)(?![\w-])/;

describe('board #390 P2 sizes', () => {
  it('Chat unread badge count is 15px', () => {
    render(<NotificationDot count={3} visible data-testid="badge" />);
    expect(screen.getByTestId('badge')).toHaveClass('text-[15px]');
    // Layout must not shrink the badge back down via className overrides.
    const dots = read('../components/Layout.tsx').match(/<NotificationDot[\s\S]*?\/>/g) ?? [];
    expect(dots.length).toBeGreaterThan(0);
    for (const d of dots) expect(d).not.toMatch(/text-\[\d+px\]|\bh-4\b|h-\[16px\]/);
  });

  it("'Men nearby' (header and map status) is 15px", () => {
    expect(read('../components/Layout.tsx')).toMatch(/text-\[15px\][^"]*" data-testid="header-men-nearby"/);
    expect(read('../components/MapLiveStatus.tsx')).not.toMatch(SMALL);
  });

  it("You 'Get verified' copy is 15px and Privacy is a 15px link with a 44x44 target", () => {
    expect(read('../components/ProfileVerification.tsx')).not.toMatch(SMALL);
    render(
      <MemoryRouter>
        <ProfileVerification
          verification={{ status: { is_verified: false }, loading: false, error: null, start: async () => {}, refresh: async () => {} } as never}
        />
      </MemoryRouter>,
    );
    const link = screen.getByTestId('verification-privacy-link');
    expect(link).toHaveClass('text-[15px]', 'min-h-[44px]', 'min-w-[44px]');
  });

  it("#386's Out spot name button is 44px tall", () => {
    expect(read('../pages/Out.tsx')).toMatch(/data-testid=\{`out-spot-open-\$\{spot\.id\}`\}[\s\S]{0,200}className="flex min-h-\[44px\]/);
  });
});

describe('board #390 round 2', () => {
  it('bell badge sits inside the 44px Alerts button (no negative top offset)', () => {
    const layout = read('../components/Layout.tsx');
    const bell = layout.match(/data-testid="badge-notifications"[\s\S]{0,200}?\/>/)?.[0] ?? '';
    const before = layout.slice(layout.indexOf('to="/notifications"'), layout.indexOf('data-testid="badge-notifications"'));
    expect(before + bell).toContain('position="top-0 right-0"');
    expect(before + bell).not.toMatch(/-top-/);
    render(<NotificationDot count={3} visible position="top-0 right-0" data-testid="bell" />);
    const dot = screen.getByTestId('bell');
    expect(dot).toHaveClass('top-0', 'right-0');
    expect(dot.className).not.toMatch(/-top-|-right-/);
  });

  it("desktop sidebar label for /conversations is 'Chat', same as the tab (board)", async () => {
    const { getNavItems } = await import('../lib/navConfig');
    const chat = getNavItems().find((i) => i.to === '/conversations')!;
    expect(chat.label).toBe('Chat');
    expect(chat.shortLabel).toBe('Chat');
  });
});
