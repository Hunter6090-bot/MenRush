/**
 * Grid view lock (Pete, 10 Oct 2026): names and tags on Nearby tiles are 15px and
 * wrap instead of being cut off; the "Filters & mood" summary is 15px with a 44px target.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NearbyProfileGrid } from './NearbyProfileGrid';

const LONG = {
  id: 'u-long',
  name: 'Christopher_from_Hackney',
  age: 41,
  online: true,
  is_verified: true,
  distance_km: 1.2,
  looking_for: 'Friends and something more',
};

describe('Nearby grid tile text', () => {
  it('name, meta and tag are 15px and never truncated', () => {
    render(
      <MemoryRouter>
        <NearbyProfileGrid users={[LONG]} loading={false} />
      </MemoryRouter>,
    );
    for (const id of ['nearby-grid-name-u-long', 'nearby-grid-meta-u-long', 'nearby-grid-tag-u-long']) {
      const el = screen.getByTestId(id);
      expect(el.className, id).toContain('text-[15px]');
      expect(el.className, id).not.toMatch(/\btruncate\b/);
      expect(el.className, id).toContain('[overflow-wrap:anywhere]');
    }
    // Verified tick sits top-right so the text block keeps the full tile width.
    const frame = screen.getByTestId('discovery-photo-frame');
    expect(frame.innerHTML).not.toMatch(/pr-9/);
  });

  it('no sub-15px text classes in the grid or the Filters & mood section', () => {
    const files = [
      'NearbyProfileGrid.tsx',
      'MoodPicker.tsx',
      'DiscoveryFilterPanel.tsx',
      'MoreFiltersDrawer.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, f), 'utf8');
      expect(src, f).not.toMatch(/\btext-\[(9|10|11|11\.5|12|13|14)px\]/);
      expect(src, f).not.toMatch(/(?<![\w-])text-(xs|sm)(?![\w-])/);
    }
    const discover = readFileSync(resolve(__dirname, '../pages/Discover.tsx'), 'utf8');
    const summary = discover.match(/<summary[^>]*>\s*Filters & mood/)?.[0] ?? '';
    expect(summary).toContain('text-[15px]');
    expect(summary).toContain('min-h-[44px]');
  });
});
