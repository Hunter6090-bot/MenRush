import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

function metaContent(attr: 'name' | 'property', key: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`);
  return html.match(re)?.[1] ?? '';
}

describe('index.html share descriptions', () => {
  it('og and twitter descriptions are the strictly true line', () => {
    for (const value of [metaContent('property', 'og:description'), metaContent('name', 'twitter:description')]) {
      expect(value).toBe("See who's around on the map. Free to join, 18+ only.");
      expect(value).not.toMatch(/right now/i);
      expect(value).not.toMatch(/beta/i);
      expect(value).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
