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
    assert.doesNotMatch(src, />\s*MENRUSH\s*</);
  });

  it('MAP | COMMUNITY segmented control is gone', () => {
    let missing = false;
    try {
      readFileSync(join(root, 'components/DiscoverySurfaceToggle.tsx'), 'utf8');
    } catch {
      missing = true;
    }
    assert.equal(missing, true);
    const discover = readFileSync(join(root, 'pages/Discover.tsx'), 'utf8');
    assert.doesNotMatch(discover, /DiscoverySurfaceToggle|MAP \| COMMUNITY/);
    const feed = readFileSync(join(root, 'components/CommunityFeed.tsx'), 'utf8');
    assert.doesNotMatch(feed, /DiscoverySurfaceToggle|showSurfaceToggle/);
  });

  it('Community is an own nav item at /stream between Nearby and Chat', () => {
    const src = readFileSync(join(root, 'lib/navConfig.ts'), 'utf8');
    assert.match(src, /to:\s*'\/stream'/);
    assert.match(src, /IconCommunity/);
    assert.match(src, /mobileTab:\s*true/);
    assert.match(src, /desktopNav:\s*true/);
    // Order in source: discover, then stream, then conversations (Chat).
    const discoverAt = src.indexOf("to: '/discover'");
    const streamAt = src.indexOf("to: '/stream'");
    const chatAt = src.indexOf("to: '/conversations'");
    assert.ok(discoverAt >= 0 && streamAt > discoverAt && chatAt > streamAt);
  });
});
