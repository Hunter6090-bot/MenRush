import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Guards the mobile-web weight regression: entry JS must not re-absorb mapbox,
 * and the primary app chunk must stay well under the old ~2.8MB monolith.
 */
describe('production bundle mobile weight', () => {
  const distAssets = resolve(__dirname, '../../dist/assets');

  it('dist exists (run npm run build before this test in CI/local)', () => {
    let ok = false;
    try {
      ok = statSync(distAssets).isDirectory();
    } catch {
      ok = false;
    }
    expect(ok).toBe(true);
  });

  it('mapbox lives in its own chunk, not the index entry', () => {
    const files = readdirSync(distAssets).filter((f) => f.endsWith('.js'));
    const indexFiles = files.filter((f) => f.startsWith('index-'));
    const mapboxFiles = files.filter((f) => f.startsWith('mapbox-'));
    expect(mapboxFiles.length).toBeGreaterThan(0);

    for (const file of indexFiles) {
      const src = readFileSync(join(distAssets, file), 'utf8');
      // mapbox-gl access token wiring may mention the string in comments rarely;
      // the library's distinctive worker bootstrap must not be in the entry.
      expect(src.includes('mapbox-gl.css') || src.includes('mapboxgl')).toBe(false);
      expect(statSync(join(distAssets, file)).size).toBeLessThan(1_200_000);
    }

    const mapboxBytes = mapboxFiles.reduce(
      (sum, f) => sum + statSync(join(distAssets, f)).size,
      0,
    );
    expect(mapboxBytes).toBeGreaterThan(500_000);
  });

  it('App.tsx uses lazy route modules (no static Discover/mapbox import)', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    expect(app).toMatch(/lazyNamed\(\(\) => import\('\.\/pages\/Discover'\)/);
    expect(app).not.toMatch(/import \{ Discover \} from '\.\/pages\/Discover'/);
    expect(app).not.toMatch(/from 'mapbox-gl'/);
  });

  it('Discover does not statically import mapbox-gl (list paints before GL chunk)', () => {
    const discover = readFileSync(resolve(__dirname, '../pages/Discover.tsx'), 'utf8');
    expect(discover).not.toMatch(/import mapboxgl from 'mapbox-gl'/);
    expect(discover).toMatch(/loadMapbox/);
    expect(discover).toMatch(/mapInitAllowed/);
  });
});
