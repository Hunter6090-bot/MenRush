import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SiteFooter } from './SiteFooter';

const css = readFileSync(resolve(__dirname, '../styles/home-surface.css'), 'utf8');
const footerSrc = readFileSync(resolve(__dirname, 'SiteFooter.tsx'), 'utf8');

function darkSurfaceTokens(): Record<string, string> {
  const block = css.match(/\.mr-dark-surface\s*\{([^}]*)\}/)?.[1];
  if (!block) throw new Error('.mr-dark-surface block missing');
  const tokens: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  const resolveVar = (v: string): string => {
    const ref = v.match(/^var\((--[\w-]+)\)$/);
    return ref ? resolveVar(tokens[ref[1]]) : v;
  };
  for (const k of Object.keys(tokens)) tokens[k] = resolveVar(tokens[k]);
  return tokens;
}

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('SiteFooter contrast', () => {
  it('sits on the dark surface in every theme', () => {
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('theme-light', theme === 'light');
      const { unmount } = render(
        <MemoryRouter>
          <SiteFooter />
        </MemoryRouter>,
      );
      expect(screen.getByRole('contentinfo')).toHaveClass('mr-dark-surface');
      unmount();
    }
  });

  it('dark surface tokens give links >= 4.5:1, normal and hover', () => {
    const t = darkSurfaceTokens();
    expect(t['--nn-bg']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrast(t['--cream-muted'], t['--nn-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['--nn-accent-text'], t['--nn-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['--nn-text'], t['--nn-bg'])).toBeGreaterThanOrEqual(4.5);
  });

  it('the light-theme muted colour on the old dark footer was the bug (< 4.5:1)', () => {
    // #5C4A32 is --nn-muted in light mode; the footer used to paint it on #0a0805.
    expect(contrast('#5C4A32', '#0a0805')).toBeLessThan(4.5);
  });

  it('uses tokens, not hard-coded hex colours', () => {
    expect(footerSrc).not.toMatch(/(?:bg|text|border)-\[#[0-9a-f]{3,8}/i);
    expect(footerSrc).toContain('text-[var(--cream-muted)]');
    expect(footerSrc).toContain('hover:text-[var(--nn-accent-text)]');
  });
});
