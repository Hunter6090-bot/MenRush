/**
 * First-launch 18+ gate (board screen 01). Self-declared, remembered per device,
 * public pages and deep links stay reachable, under 18 leaves the app.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { FirstLaunchAgeGate, UnderAgeExit } from './FirstLaunchAgeGate';
import {
  AGE_GATE_ADULT_VALUE,
  AGE_GATE_STORAGE_KEY,
  isAgeGateExemptPath,
  resetAgeGateMemoryForTests,
} from '../lib/ageGate';
import { contrast, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

function AppPage() {
  const loc = useLocation();
  return <div data-testid="app-page">{loc.pathname + loc.search + loc.hash}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FirstLaunchAgeGate>
        <Routes>
          <Route path="/under-18" element={<UnderAgeExit />} />
          <Route path="*" element={<AppPage />} />
        </Routes>
      </FirstLaunchAgeGate>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetAgeGateMemoryForTests();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('first app launch', () => {
  it('shows the gate, not the app', () => {
    renderAt('/discover');
    expect(screen.getByTestId('age-gate')).toBeInTheDocument();
    expect(screen.getByText('18+')).toBeInTheDocument();
    expect(screen.getByText('Men only. 18 and over.')).toBeInTheDocument();
    expect(screen.getByTestId('brand-mark')).toBeInTheDocument();
    expect(screen.queryByTestId('app-page')).toBeNull();
  });

  it('gates sign in and the app entry too', () => {
    for (const path of ['/login', '/app', '/messages', '/rooms/abc']) {
      renderAt(path);
      expect(screen.getByTestId('age-gate')).toBeInTheDocument();
      cleanup();
    }
  });
});

describe("tapping I'm 18 or over", () => {
  it('opens the deep link that was asked for, query and hash kept', () => {
    renderAt('/profile/u123?tab=albums#photos');
    fireEvent.click(screen.getByTestId('age-gate-confirm'));
    expect(screen.queryByTestId('age-gate')).toBeNull();
    expect(screen.getByTestId('app-page')).toHaveTextContent('/profile/u123?tab=albums#photos');
  });

  it('is remembered on this device: the gate shows once', () => {
    renderAt('/discover');
    fireEvent.click(screen.getByTestId('age-gate-confirm'));
    expect(window.localStorage.getItem(AGE_GATE_STORAGE_KEY)).toBe(AGE_GATE_ADULT_VALUE);
    cleanup();
    resetAgeGateMemoryForTests(); // fresh launch: only storage remains
    renderAt('/messages');
    expect(screen.queryByTestId('age-gate')).toBeNull();
    expect(screen.getByTestId('app-page')).toHaveTextContent('/messages');
  });

  it('still lets you in for the session when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderAt('/discover');
    fireEvent.click(screen.getByTestId('age-gate-confirm'));
    expect(screen.getByTestId('app-page')).toBeInTheDocument();
  });
});

describe("tapping I'm under 18", () => {
  it('leaves the app for the public exit page and stores nothing', () => {
    renderAt('/discover');
    fireEvent.click(screen.getByTestId('age-gate-leave'));
    expect(screen.getByTestId('age-gate-exit')).toBeInTheDocument();
    expect(screen.queryByTestId('app-page')).toBeNull();
    expect(screen.queryByTestId('age-gate-confirm')).toBeNull();
    expect(window.localStorage.getItem(AGE_GATE_STORAGE_KEY)).toBeNull();
    // Only public links remain on the exit page.
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/terms', '/privacy', '/help']);
    cleanup();
    resetAgeGateMemoryForTests();
    renderAt('/discover');
    expect(screen.getByTestId('age-gate')).toBeInTheDocument();
  });
});

describe('public routes skip the gate', () => {
  const PUBLIC = [
    '/',
    '/pride',
    '/pride/route',
    '/brightonpride',
    '/coming-soon',
    '/get-the-app',
    '/terms',
    '/privacy',
    '/cookies',
    '/contact',
    '/safety',
    '/guidelines',
    '/help',
    '/invite',
    '/invite?code=ABC',
    '/beta?invite=ABC',
    '/register',
    '/register?invite=ABC',
    '/register/underage',
    '/under-18',
  ];
  it.each(PUBLIC)('%s renders without the gate', (path) => {
    renderAt(path);
    expect(screen.queryByTestId('age-gate')).toBeNull();
  });

  it('app routes are not exempt', () => {
    for (const p of ['/discover', '/login', '/app', '/registered', '/pridex', '/invitations']) {
      expect(isAgeGateExemptPath(p)).toBe(false);
    }
  });
});

describe('copy and size locks', () => {
  const src = readFileSync(resolve(__dirname, 'FirstLaunchAgeGate.tsx'), 'utf8');
  const visible = () => document.body.textContent ?? '';

  it('makes no ID or verification claim, no beta, no dashes', () => {
    renderAt('/discover');
    const gate = visible();
    cleanup();
    renderAt('/under-18');
    const exit = visible();
    for (const text of [gate, exit]) {
      expect(text).not.toMatch(/\b(verif\w*|ID|identity|passport|licen[cs]e|selfie|Veriff|checked|beta)\b/i);
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it('text is 15px or more and tap targets are at least 44px', () => {
    expect(src).not.toMatch(/\btext-(xs|sm)\b|text-\[(\d|1[0-4])px\]/);
    renderAt('/discover');
    const taps = [...document.querySelectorAll('button, a')];
    expect(taps.length).toBeGreaterThanOrEqual(5);
    for (const el of taps) {
      const m = el.className.match(/min-h-\[(\d+)px\]/);
      expect(m && Number(m[1])).toBeGreaterThanOrEqual(44);
    }
  });
});

describe.each<Theme>(['light', 'dark'])('WCAG AA contrast (%s)', (theme) => {
  it('every text element is at least 4.5:1', () => {
    renderAt('/discover');
    const els = [
      screen.getByText('18+'),
      screen.getByText('Men only. 18 and over.'),
      screen.getByText('Please confirm your age to continue.'),
      screen.getByTestId('age-gate-confirm'),
      screen.getByTestId('age-gate-leave'),
      ...screen.getAllByRole('link'),
    ];
    for (const el of els) expect(contrast(el, theme)).toBeGreaterThanOrEqual(4.5);
  });

  it('exit page text is at least 4.5:1', () => {
    renderAt('/under-18');
    for (const el of [screen.getByRole('heading'), screen.getByText(/You need to be 18/)]) {
      expect(contrast(el, theme)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the outline button border is at least 3:1 against the page', () => {
    expect(tokenContrast('var(--copper)', 'var(--bg-primary)', theme, 'var(--bg-primary)')).toBeGreaterThanOrEqual(3);
  });
});
