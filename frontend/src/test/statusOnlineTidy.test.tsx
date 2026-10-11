/**
 * QC follow-ons after #415:
 * - TwoFactorSettings badges (Protected / Optional / This device) are 15px, and
 *   Protected uses --status-online-text for 4.5:1. Nothing in the panel is under 15px,
 *   no hardcoded colours, every button is 44px.
 * - The grid live-count pill's 85% background actually applies (a Tailwind /85 opacity
 *   modifier on a var() colour generates no CSS, so it was transparent).
 * - ProfileDrawer "Now" line uses --status-online-text.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from './themeContrast';
import { TwoFactorSettings } from '../components/TwoFactorSettings';
import { authAPI } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    authAPI: { ...actual.authAPI, getTwoFactorStatus: vi.fn(), listTrustedDevices: vi.fn() },
  };
});

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
const THEMES: Theme[] = ['light', 'dark'];

async function renderTwoFactor(enabled: boolean) {
  vi.mocked(authAPI.getTwoFactorStatus).mockResolvedValue({ data: { enabled, enabledAt: enabled ? '2026-10-01T10:00:00Z' : null } } as never);
  vi.mocked(authAPI.listTrustedDevices).mockResolvedValue({
    data: { devices: [{ id: 'd1', label: 'This Mac', lastUsedAt: '2026-10-10T10:00:00Z', expiresAt: '2026-11-10T10:00:00Z', createdAt: '2026-10-01T10:00:00Z', isCurrent: true }] },
  } as never);
  render(<TwoFactorSettings />);
  return screen.findByTestId('two-factor-settings');
}

describe('TwoFactorSettings badges', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(THEMES)('Protected and This device: 15px, at least 4.5:1 (%s)', async (theme) => {
    await renderTwoFactor(true);
    const protectedBadge = screen.getByTestId('two-factor-badge-protected');
    const thisDevice = await screen.findByTestId('two-factor-badge-this-device');
    for (const el of [protectedBadge, thisDevice]) {
      expect(el).toHaveClass('text-[15px]');
      expect(contrast(el, theme)).toBeGreaterThanOrEqual(4.5);
    }
    expect(protectedBadge).toHaveClass('text-[var(--status-online-text)]');
    // Also on a card, where Settings shows the panel.
    expect(
      tokenContrast('var(--status-online-text)', 'color-mix(in srgb, var(--status-online-text) 10%, transparent)', theme),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)('Optional: 15px, at least 4.5:1 (%s)', async (theme) => {
    await renderTwoFactor(false);
    const badge = screen.getByTestId('two-factor-badge-optional');
    expect(badge).toHaveClass('text-[15px]');
    expect(contrast(badge, theme)).toBeGreaterThanOrEqual(4.5);
  });

  it('the panel has no text under 15px, no hardcoded colours, and 44px buttons', async () => {
    const root = await renderTwoFactor(true);
    await screen.findByTestId('two-factor-badge-this-device');
    const src = read('../components/TwoFactorSettings.tsx');
    expect(src).not.toMatch(/text-\[(?:[0-9]|1[0-4])px\]|\btext-(?:xs|sm)\b/);
    expect(src).not.toMatch(/\[var\(--[\w-]+\)\]\/\d+/); // opacity modifiers on var() never apply
    expect(hardcodedColourClasses(root)).toEqual([]);
    for (const b of Array.from(root.querySelectorAll('button'))) expect(b).toHaveClass('min-h-[44px]');
  });
});

describe('TwoFactorSettings P1s after #419', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(THEMES)('Protected border is about 75 percent and at least 3:1 against the badge and the card (%s)', async (theme) => {
    await renderTwoFactor(true);
    const badge = screen.getByTestId('two-factor-badge-protected');
    expect(badge).toHaveClass('border-[color-mix(in_srgb,var(--status-online-text)_75%,transparent)]');
    // The border paints over the badge's own 10% tint (background-clip: border-box), so the
    // edge colour is 75% + 25% of 10% = 77.5% of --status-online-text over the card.
    const edge = 'color-mix(in srgb, var(--status-online-text) 77.5%, transparent)';
    const fill = 'color-mix(in srgb, var(--status-online-text) 10%, transparent)';
    for (const base of ['var(--bg-card)', 'var(--bg-primary)', 'var(--bg-elevated)']) {
      expect(tokenContrast(edge, fill, theme, base)).toBeGreaterThanOrEqual(3);
      expect(tokenContrast(edge, base, theme, base)).toBeGreaterThanOrEqual(3);
    }
  });

  it('"This device" wraps instead of truncating on narrow phones, at 15px', async () => {
    await renderTwoFactor(true);
    const badge = await screen.findByTestId('two-factor-badge-this-device');
    const row = screen.getByTestId('two-factor-device-label');
    expect(row).not.toHaveClass('truncate');
    expect(row).toHaveClass('flex', 'flex-wrap');
    expect(row.contains(badge)).toBe(true);
    // The badge keeps its two words together and drops to its own line; the label breaks.
    expect(badge).toHaveClass('whitespace-nowrap', 'text-[15px]');
    expect(badge).not.toHaveClass('truncate');
    expect(row.querySelector('span:not([data-testid])')).toHaveClass('break-words');
    expect(read('../components/TwoFactorSettings.tsx')).not.toMatch(/\btruncate\b/);
  });
});

describe('grid live-count pill', () => {
  const discover = read('../pages/Discover.tsx');
  const pills = discover.match(/data-testid="nearby-counts"[\s\S]*?className="([^"]*)"/g) ?? [];

  it('both pills use a background that Tailwind can build (no /85 on a var colour)', () => {
    expect(pills).toHaveLength(2);
    for (const p of pills) {
      expect(p).toContain('bg-[color-mix(in_srgb,var(--bg-elevated)_85%,transparent)]');
      expect(p).not.toMatch(/bg-\[var\(--[\w-]+\)\]\/\d+/);
    }
  });

  it.each(THEMES)('"· N live" is at least 4.5:1 on the pill over the page (%s)', (theme) => {
    expect(
      tokenContrast('var(--status-online-text)', 'color-mix(in srgb, var(--bg-elevated) 85%, transparent)', theme, 'var(--bg-primary)'),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('ProfileDrawer "Now" line', () => {
  it('uses --status-online-text, at least 4.5:1 on the sheet in both themes', () => {
    const src = read('../components/ProfileDrawer.tsx');
    expect(src).toMatch(/text-\[var\(--status-online-text\)\]" data-testid="pin-sheet-now"/);
    for (const theme of THEMES)
      for (const bg of ['--bg-primary', '--bg-elevated', '--bg-card'])
        expect(tokenContrast('var(--status-online-text)', `var(${bg})`, theme)).toBeGreaterThanOrEqual(4.5);
  });
});
