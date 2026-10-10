import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

function metaContent(attr: 'name' | 'property', key: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`);
  return html.match(re)?.[1] ?? '';
}

const TITLE = 'MenRush | Gay men near you, UK';
const DESCRIPTION =
  "MenRush is an app for gay men in the UK. See who's around on the map, chat, and find cruising spots. Free to join, 18+ only.";
const SHARE_DESCRIPTION = "See who's around on the map. Free to join, 18+ only.";

/** Strictly true and on brand: no live-presence promise, no beta, no em/en dash, nothing dating-coded, no hookup label, no numbers. */
function expectOnBrand(value: string) {
  expect(value).not.toBe('');
  expect(value).not.toMatch(/right now|nearby now/i);
  expect(value).not.toMatch(/beta/i);
  expect(value).not.toMatch(/[\u2013\u2014]/);
  expect(value).not.toMatch(/hookup/i);
  expect(value).not.toMatch(/\b(dating|date|match|matches|romance|relationship|soulmate)\b/i);
  expect(value).not.toMatch(/pulse for now/i);
  expect(value).not.toMatch(/waitlist|on the list/i);
  expect(value).not.toMatch(/\d{2,}[\d,]*\s*(\+\s*)?(members|men|users|signups|sign-ups)/i);
}

describe('index.html meta', () => {
  it('title is the strictly true line', () => {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    expect(title).toBe(TITLE);
    expectOnBrand(title);
  });

  it('og and twitter titles match the page title', () => {
    for (const value of [metaContent('property', 'og:title'), metaContent('name', 'twitter:title')]) {
      expect(value).toBe(TITLE);
    }
  });

  it('meta description is the strictly true line', () => {
    const value = metaContent('name', 'description');
    expect(value).toBe(DESCRIPTION);
    expectOnBrand(value);
  });

  it('og and twitter descriptions are the strictly true line', () => {
    for (const value of [metaContent('property', 'og:description'), metaContent('name', 'twitter:description')]) {
      expect(value).toBe(SHARE_DESCRIPTION);
      expectOnBrand(value);
    }
  });

  it('keywords carry no hookup or dating label', () => {
    const value = metaContent('name', 'keywords');
    expect(value).not.toMatch(/hookup|dating/i);
  });

  it('whole head has no em dash, beta or right now', () => {
    const head = html.split('</head>')[0];
    expect(head).not.toMatch(/[\u2014]/);
    expect(head).not.toMatch(/right now/i);
    expect(head).not.toMatch(/\bbeta\b/i);
  });
});
