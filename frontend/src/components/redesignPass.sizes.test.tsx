/**
 * Fast-follow type and tap targets (QC P1s after #316): 15px minimum text on the listed surfaces,
 * 44px minimum tap targets, and the You avatar no longer sits on the "Tap Adjust cover" hint.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifiedBadge } from './VerifiedBadge';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
const SMALL_TEXT = /(?<![\w[-])(?:[a-z0-9]+:)*text-(?:xs|sm|\[(?:9|10|11|11\.5|12|13|14)px\])(?![\w[-])/g;

describe('15px minimum text', () => {
  it.each([
    'NearbyProfileGrid.tsx',
    'NearbySortToggle.tsx',
    'RoomList.tsx',
    'RoomsHub.tsx',
    '../pages/Out.tsx',
    'CruisingSearchBar.tsx',
    'CruisingSearchSheet.tsx',
    'CruisingSpotCard.tsx',
    '../pages/Profile.tsx',
  ])('%s has no text below 15px', (file) => {
    expect(read(file).match(SMALL_TEXT) ?? []).toEqual([]);
  });

  it('chat timestamps and the map disclaimer are 15px', () => {
    expect(read('ConversationItem.tsx')).toContain('<span className="text-[15px] text-nn-faint">{formatRelative(lastMessageTime)}</span>');
    const thread = read('../pages/Messaging.tsx');
    expect(thread).toMatch(/text-\[15px\] mt-1 px-1 text-\[var\(--cream-muted\)\]"\s*>\s*\{formatTime\(msg\.created_at\)\}/);
    for (const m of thread.matchAll(/className="([^"]*)"[^>]*>\s*\{formatDateLabel\(msg\.created_at\)\}/g)) {
      expect(m[1]).toContain('text-[15px]');
    }
    const discover = read('../pages/Discover.tsx');
    const copy = discover.slice(discover.indexOf('data-testid="hotspots-map-helper"'), discover.indexOf('data-testid="hotspots-map-helper-copy"'));
    expect(copy).toContain('text-[15px]');
  });
});

describe('44px tap targets', () => {
  const has = (file: string, needle: string) => expect(read(file), `${file}: ${needle}`).toContain(needle);

  it('header icons, Create group, Join, disclaimer close, cruising close, clear search and filter chips', () => {
    has('ThemeToggle.tsx', 'flex h-11 w-11 items-center');
    has('Layout.tsx', 'className="relative flex h-11 w-11 items-center justify-center rounded-full text-[var(--cream-soft)]');
    has('Layout.tsx', 'aria-label="MenRush home"\n                  className="inline-flex min-h-[44px] min-w-[44px]');
    has('RoomList.tsx', 'className="flex h-11 w-11 items-center justify-center rounded-2xl');
    has('RoomList.tsx', 'className="min-h-[44px] min-w-[64px] rounded-lg px-4 py-2 text-[15px] font-bold');
    has('../pages/Profile.tsx', 'className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--cream-soft)]');
    has('../pages/Discover.tsx', 'aria-label="Dismiss map disclaimer"');
    expect(read('../pages/Discover.tsx')).toMatch(/aria-label="Dismiss map disclaimer"[\s\S]{0,300}className="absolute right-0 top-0 flex h-11 w-11/);
    const sheet = read('CruisingSearchSheet.tsx');
    expect(sheet).toMatch(/aria-label="Close cruising search"[\s\S]{0,120}className="flex h-11 w-11/);
    expect(sheet).toMatch(/aria-label="Clear search query"\s*className="absolute right-0 top-1\/2 flex h-11 w-11/);
    expect(sheet.match(/inline-flex min-h-\[44px\] items-center[^`]*rounded-full px-3 py-1 font-bold whitespace-nowrap/g)).toHaveLength(2);
  });

  it('chat header and composer icons are 44px', () => {
    const thread = read('../pages/Messaging.tsx');
    for (const label of ['Start video call', 'Send current location', 'Open camera', 'Attach from My Photos', 'Record voice note']) {
      const at = thread.indexOf(`aria-label="${label}"`);
      expect(at, label).toBeGreaterThan(0);
      const cls = thread.slice(at, at + 400).match(/className="([^"]*)"/)?.[1] ?? '';
      expect(cls, label).toMatch(/\bh-11 w-11\b|\bw-11 h-11\b/);
      expect(cls, label).not.toMatch(/\bh-10\b|\bw-10\b/);
    }
  });

  it('Verified tick button is 44x44 around an 18px tick, with negative margins keeping the layout', () => {
    render(<VerifiedBadge />);
    const tick = screen.getByTestId('verified-tick');
    expect(tick.className).toMatch(/\bh-11 w-11 -m-\[13px\]/);
    expect(tick.querySelector('svg')).toHaveAttribute('width', '18');
    vi.restoreAllMocks();
  });
});

describe('You header', () => {
  it('"Tap Adjust cover" sits below the avatar row, not under the overlapping avatar', () => {
    const src = read('../pages/Profile.tsx');
    const row = src.indexOf('data-testid="profile-avatar-row"');
    const hint = src.indexOf('data-testid="profile-adjust-cover-hint"');
    expect(row).toBeGreaterThan(0);
    expect(hint).toBeGreaterThan(row);
    expect(src.match(/Tap Adjust cover to move or zoom your banner/g)).toHaveLength(1);
  });
});
