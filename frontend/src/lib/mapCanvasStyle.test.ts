import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Mapbox canvas CSS sizing invariants (P0 tile distortion fix)', () => {
  it('does not force canvas width/height to 100% in Discover.tsx', () => {
    const discoverSrc = fs.readFileSync(
      path.resolve(__dirname, '../pages/Discover.tsx'),
      'utf8',
    );
    // .mapboxgl-canvas must not be forced to 100% width or height.
    // Mapbox GL calculates canvas.width = dpr * clientWidth and canvas.style.width = `${clientWidth}px`.
    // Overriding canvas.style.width/height with 100% !important distorts the WebGL framebuffer
    // aspect ratio and causes stretched vertical stripes/glitches on high-DPR mobile displays.
    const hasCanvas100Percent =
      /(?:^|[,\s])\.mapboxgl-canvas\s*\{[^}]*(?:width|height):\s*100%/m.test(discoverSrc) ||
      /(?:^|[,\s])\.discover-map-surface\s+\.mapboxgl-canvas\s*\{[^}]*(?:width|height):\s*100%/m.test(discoverSrc);

    expect(hasCanvas100Percent).toBe(false);
  });

  it('keeps map and canvas-container at 100% to fill the host panel', () => {
    const discoverSrc = fs.readFileSync(
      path.resolve(__dirname, '../pages/Discover.tsx'),
      'utf8',
    );
    expect(discoverSrc).toMatch(/\.mapboxgl-map\s*\{[^}]*width:\s*100%\s*!important/);
    expect(discoverSrc).toMatch(/\.mapboxgl-canvas-container\s*\{[^}]*width:\s*100%\s*!important/);
  });

  it('does not force mapboxgl-canvas in globals.css to 100%', () => {
    const globalsSrc = fs.readFileSync(
      path.resolve(__dirname, '../styles/globals.css'),
      'utf8',
    );
    expect(globalsSrc).not.toMatch(/\.mapboxgl-canvas\s*\{[^}]*width:\s*100%/);
  });
});
