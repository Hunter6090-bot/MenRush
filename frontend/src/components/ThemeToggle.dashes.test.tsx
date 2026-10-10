import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { THEME_STORAGE_KEY } from '../lib/theme';

const DASH = /[—–]/;

describe('ThemeToggle copy has no em or en dashes', () => {
  beforeEach(() => localStorage.setItem(THEME_STORAGE_KEY, 'light'));

  it('source files carry no em or en dashes', () => {
    for (const f of ['./ThemeToggle.tsx', './ThemeToggleFab.tsx', '../lib/theme.ts']) {
      expect(readFileSync(resolve(__dirname, f), 'utf8'), f).not.toMatch(DASH);
    }
  });

  it('every state reads as plain sentences: Light, Dark, System', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const texts = [btn.textContent ?? '', btn.getAttribute('aria-label') ?? '', btn.getAttribute('title') ?? ''];
      for (const t of texts) expect(t, t).not.toMatch(DASH);
      seen.push(btn.textContent ?? '');
      await user.click(btn);
    }
    expect(seen).toEqual(['Light theme. Tap for Dark.', 'Dark theme. Tap for System.', 'System theme. Tap for Light.']);
  });
});
