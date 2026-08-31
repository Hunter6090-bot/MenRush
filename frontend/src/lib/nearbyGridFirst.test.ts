import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Nearby Grid-first Brand lock', () => {
  it('phone PROFILE_TILE_GRID_CLASS stays three-up', async () => {
    const { PROFILE_TILE_GRID_CLASS } = await import('./profileTileGrid.ts');
    assert.match(PROFILE_TILE_GRID_CLASS, /\bgrid-cols-3\b/);
    assert.doesNotMatch(PROFILE_TILE_GRID_CLASS, /\bgrid-cols-2\b/);
  });

  it('Map/Grid toggle never says MODE', () => {
    const src = readFileSync(join(root, 'components/NearbyMapGridToggle.tsx'), 'utf8');
    assert.doesNotMatch(src, /GRID MODE|MAP MODE|\bMODE\b/);
    assert.match(src, /'Map'/);
    assert.match(src, /'Grid'/);
  });

  it('Layout discover mark has no MENRUSH type wordmark', () => {
    const src = readFileSync(join(root, 'components/Layout.tsx'), 'utf8');
    // BrandMark only on discover header / sidebar home — no typed MENRUSH next to it.
    assert.doesNotMatch(src, />\s*MENRUSH\s*</);
  });
});
