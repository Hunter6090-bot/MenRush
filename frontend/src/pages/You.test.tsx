/**
 * You tab rebuild (Claude Design board "07 You / settings", Pete lock 10 Oct 2026).
 * Rows only, real values, Veriff-only "ID verified", Coming soon rows that never
 * navigate, every old You control still reachable, contrast and size locks.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
loadThemeTokens(read('../styles/menrush-tokens.css'));

const api = vi.hoisted(() => ({
  getMe: vi.fn(),
  listMine: vi.fn(),
  getTwoFactorStatus: vi.fn(),
  getMapPinFuzz: vi.fn(),
  setMapPinFuzz: vi.fn(),
  updateProfile: vi.fn(),
}));
const verification = vi.hoisted(() => ({ status: null as null | { is_verified: boolean; status: string } }));

vi.mock('../api/client', () => ({
  usersAPI: { getMe: api.getMe, updateProfile: api.updateProfile },
  albumsAPI: { listMine: api.listMine },
  authAPI: { getTwoFactorStatus: api.getTwoFactorStatus },
  profileMetaAPI: { getMapPinFuzz: api.getMapPinFuzz, setMapPinFuzz: api.setMapPinFuzz },
}));
vi.mock('../hooks/useVerification', () => ({
  useVerification: () => ({ status: verification.status, loading: false, error: '', start: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../hooks/store', () => {
  const state = { user: { id: 'u1', name: 'Dan', photo_url: '/uploads/dan.jpg' } };
  const useAuthStore = (sel?: (s: typeof state) => unknown) => (sel ? sel(state) : state);
  return { useAuthStore };
});
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

import { You, REQUEST_SIGN_OUT_EVENT, fitNameSize, YOU_AVATAR_PX, YOU_NAME_MAX_PX, YOU_NAME_MIN_PX } from './You';
import { VERIFY_HOME_PATH, YOU_FEATURE_STATUS, YOU_ROW_CARDS } from '../lib/youRows';

let lastPath = '';
function PathSpy() {
  const loc = useLocation();
  lastPath = loc.pathname + loc.hash;
  return null;
}

function renderYou() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <PathSpy />
      <Routes>
        <Route path="/profile" element={<You />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  verification.status = null;
  api.getMe.mockResolvedValue({ data: { name: 'Dan', photo_url: '/uploads/dan.jpg' } });
  api.listMine.mockResolvedValue({ data: { albums: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } });
  api.getTwoFactorStatus.mockResolvedValue({ data: { enabled: true, enabledAt: null } });
  api.getMapPinFuzz.mockResolvedValue({ data: { map_pin_fuzz_m: 320 } });
});

const BOARD_ORDER = ['Albums', 'Discretion', 'Quiet hours', '2FA', 'Settings', 'Merch', 'Brands'];

describe('You tab: rows only, in board order', () => {
  it('shows the board rows in order, then Sign out, with no forms, inputs or cover', async () => {
    renderYou();
    await screen.findByTestId('you-row-value-albums');
    const page = screen.getByTestId('you-rows-page');
    const card1 = within(screen.getByTestId('you-card-1'));
    const card2 = within(screen.getByTestId('you-card-2'));
    const labels = [
      ...YOU_ROW_CARDS[0].map((r) => r.label),
      ...YOU_ROW_CARDS[1].map((r) => r.label),
    ];
    expect(labels).toEqual(BOARD_ORDER);
    for (const l of BOARD_ORDER.slice(0, 5)) expect(card1.getByText(l)).toBeInTheDocument();
    for (const l of BOARD_ORDER.slice(5)) expect(card2.getByText(l)).toBeInTheDocument();
    // DOM order matches the board, Sign out last.
    const text = page.textContent ?? '';
    let at = -1;
    for (const l of [...BOARD_ORDER, 'Sign out']) {
      const next = text.indexOf(l, at + 1);
      expect(next, l).toBeGreaterThan(at);
      at = next;
    }
    expect(page.querySelector('form, input, textarea, select')).toBeNull();
    expect(screen.queryByText(/Adjust cover|Change photo|Active now|Edit Profile|Map photo/i)).toBeNull();
    expect(screen.getByTestId('brand-mark')).toBeInTheDocument();
    expect(screen.getByTestId('you-edit').getAttribute('href')).toBe('/profile/edit');
  });

  it('live rows show real values and go to real screens', async () => {
    renderYou();
    expect(await screen.findByTestId('you-row-value-albums')).toHaveTextContent('3');
    expect(await screen.findByTestId('you-row-value-two-factor')).toHaveTextContent('On');
    expect(await screen.findByTestId('you-row-value-discretion')).toHaveTextContent('~320 m');
    expect(screen.getByTestId('you-row-albums').getAttribute('href')).toBe('/albums');
    expect(screen.getByTestId('you-row-two-factor').getAttribute('href')).toBe('/settings#two-factor');
    expect(screen.getByTestId('you-row-settings').getAttribute('href')).toBe('/settings');
  });

  it('2FA reads Off when it is off', async () => {
    api.getTwoFactorStatus.mockResolvedValue({ data: { enabled: false, enabledAt: null } });
    renderYou();
    expect(await screen.findByTestId('you-row-value-two-factor')).toHaveTextContent('Off');
  });

  it('Discretion opens the existing Discretion control and never writes on open', async () => {
    renderYou();
    await screen.findByTestId('you-row-value-discretion');
    fireEvent.click(screen.getByTestId('you-row-discretion'));
    const sheet = screen.getByTestId('you-discretion-sheet');
    expect(within(sheet).getByTestId('menu-discretion')).toBeInTheDocument();
    await waitFor(() => expect(within(sheet).getByTestId('map-discretion-range')).not.toBeDisabled());
    expect(api.setMapPinFuzz).not.toHaveBeenCalled();
    expect(lastPath).toBe('/profile');
  });

  it('opening You writes nothing', async () => {
    renderYou();
    await screen.findByTestId('you-row-value-albums');
    expect(api.setMapPinFuzz).not.toHaveBeenCalled();
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('Sign out asks Layout for the usual confirm', async () => {
    const spy = vi.fn();
    window.addEventListener(REQUEST_SIGN_OUT_EVENT, spy);
    renderYou();
    fireEvent.click(screen.getByTestId('you-sign-out'));
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(REQUEST_SIGN_OUT_EVENT, spy);
  });
});

describe('ID verified (Veriff only, same tick as the rest of the app)', () => {
  it('shows the shared verified tick and "ID verified" only when Veriff-verified', async () => {
    verification.status = { is_verified: true, status: 'approved' };
    renderYou();
    const badge = await screen.findByTestId('you-id-verified');
    expect(badge).toHaveTextContent('ID verified');
    expect(within(badge).getByTestId('verified-tick')).toBeInTheDocument();
  });

  it.each([null, { is_verified: false, status: 'pending' }, { is_verified: false, status: 'declined' }])(
    'hides it when not verified (%o)',
    async (status) => {
      verification.status = status;
      renderYou();
      await screen.findByTestId('you-row-value-albums');
      expect(screen.queryByTestId('you-id-verified')).toBeNull();
      expect(screen.queryByText('ID verified')).toBeNull();
      expect(screen.queryByTestId('verified-tick')).toBeNull();
    },
  );

  it('uses VerifiedBadge, not a new badge', () => {
    const src = read('./You.tsx');
    expect(src).toMatch(/<VerifiedBadge tone="surface" \/>/);
    expect(src).toMatch(/verification\.status\?\.is_verified === true/);
  });
});

describe('Coming soon rows', () => {
  const soon = (Object.keys(YOU_FEATURE_STATUS) as Array<keyof typeof YOU_FEATURE_STATUS>).filter(
    (id) => YOU_FEATURE_STATUS[id] === 'coming_soon',
  );

  it('config marks exactly Quiet hours, Merch and Brands as Coming soon', () => {
    expect(soon.sort()).toEqual(['brands', 'merch', 'quiet-hours']);
  });

  it.each([
    ['quiet-hours', 'Quiet hours'],
    ['merch', 'Merch'],
    ['brands', 'Brands'],
  ])('%s shows the tag and a short notice, and never navigates', async (id, label) => {
    renderYou();
    const row = screen.getByTestId(`you-row-${id}`);
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('href')).toBeNull();
    expect(within(row).getByTestId(`you-row-soon-${id}`)).toHaveTextContent('Coming soon');
    expect(within(row).queryByText(/\d/)).toBeNull();
    act(() => {
      fireEvent.click(row);
    });
    const notice = screen.getByTestId('you-coming-soon-notice');
    expect(notice).toHaveTextContent(`${label} is coming soon.`);
    // No dates, times or promises in the notice.
    expect(notice.textContent).not.toMatch(/\d|today|tomorrow|week|month|soon you can|now available/i);
    expect(lastPath).toBe('/profile');
  });

  it('a live row has no Coming soon tag', async () => {
    renderYou();
    for (const id of ['albums', 'discretion', 'two-factor', 'settings']) {
      expect(screen.queryByTestId(`you-row-soon-${id}`)).toBeNull();
    }
  });
});

describe('Nothing lost: every old You control is still reachable', () => {
  const edit = read('./Profile.tsx');
  const you = read('./You.tsx');
  const menu = read('../components/AccountMenu.tsx');

  // Old You control -> proof it lives on the Edit screen (/profile/edit), a row, or the Menu.
  const ON_EDIT: Array<[string, RegExp]> = [
    ['Cover photo upload', /aria-label="Upload cover photo"/],
    ['Adjust cover', />\s*Adjust cover\s*</],
    ['Change photo (cover)', /'Change photo'/],
    ['Profile photo upload', /aria-label="Upload profile photo"/],
    ['Active now pill', /<StatusBadge online=\{!!profile\.online\}/],
    ['Settings cog', /aria-label="Open settings"/],
    ['Get verified (ProfileVerification)', /<div id="verify">\s*<ProfileVerification/],
    ['Edit Profile form', /data-testid="profile-edit-form"/],
    ['Map photo', /data-testid="map-photo-section"/],
    ['Display name, DOB, bio, headline', /profile-field-display-name[\s\S]*profile-field-dob[\s\S]*profile-field-bio[\s\S]*profile-field-headline/],
    ['Looking for, Stats, Hosting, Sexual health, Photo, Tags', /profile-field-looking[\s\S]*profile-stats-section[\s\S]*profile-field-hosting[\s\S]*Sexual health[\s\S]*profile-field-photo[\s\S]*profile-field-tags/],
    ['Save Changes', /'Save Changes'/],
    ['Viewed me', /<div id="viewed-me">\s*<ProfileViewersCard/],
    ['Invite (Referrals)', /<div id="invite">\s*<ReferralCard/],
    ['Your location', /id="privacy"[\s\S]{0,400}>Your location</],
    ['Mood', /id="mood"[\s\S]{0,400}>Mood</],
    ['Ghost mode', /<div id="ghost">\s*<GhostToggle/],
    ['My Photos link', /to="\/albums"/],
    ['Hide my location', /to="\/settings#hide-location"/],
    ['Blocked people', /to="\/settings#blocked"/],
    ['Profile visibility', />Profile visibility</],
  ];

  it.each(ON_EDIT)('%s is on the Edit screen', (_name, re) => {
    expect(edit).toMatch(re);
  });

  it('the Edit screen is routed at /profile/edit and You links to it', () => {
    const app = read('../App.tsx');
    expect(app).toMatch(/path="\/profile\/edit"[\s\S]{0,200}<Profile \/>/);
    expect(app).toMatch(/path="\/profile"[\s\S]{0,200}<You \/>/);
    expect(you).toMatch(/to=\{PROFILE_EDIT_PATH\}/);
  });

  it('Menu anchors that used to hit the old You page now land on Edit', () => {
    for (const hash of ['viewed-me', 'mood', 'ghost', 'invite', 'privacy', 'verify']) {
      expect(menu).toContain(`'/profile/edit#${hash}'`);
      expect(edit).toContain(`id="${hash}"`);
    }
    expect(menu).not.toMatch(/'\/profile#/);
  });

  it('the entry behind Edit is labelled Get verified everywhere (Brand), and the tick says ID verified', () => {
    expect(menu).toContain("{ id: 'verify', label: 'Get verified', to: '/profile/edit#verify' }");
    expect(read('../components/ProfileVerification.tsx')).toContain("'Get verified'");
    expect(read('./Help.tsx')).toContain('tap Get verified in You > Edit');
    for (const f of ['../components/AccountMenu.tsx', './You.tsx', './Profile.tsx', './Help.tsx', './Settings.tsx']) {
      expect(read(f), f).not.toMatch(/Verify ID/);
    }
    expect(you).toContain('<span>ID verified</span>');
  });

  it('Sign out moved to the You rows page; Albums, 2FA and Settings are rows', () => {
    expect(you).toMatch(/data-testid="you-sign-out"/);
    expect(edit).not.toMatch(/You'll need to log back in/);
  });

  it('the cover hint sits below the avatar row, never behind the photo', () => {
    const row = edit.indexOf('data-testid="profile-avatar-row"');
    const rowEnd = edit.indexOf('<h2', row);
    const hint = edit.indexOf('data-testid="profile-adjust-cover-hint"');
    expect(row).toBeGreaterThan(0);
    expect(hint).toBeGreaterThan(rowEnd);
    const hintTag = edit.slice(edit.lastIndexOf('<p', hint), hint);
    expect(hintTag).not.toMatch(/absolute|-mt-|uppercase/);
  });
});

describe.each<Theme>(['light', 'dark'])('You contrast (%s)', (theme) => {
  it('row text, values and the Coming soon tag >= 4.5:1, icons >= 3:1, tokens only', async () => {
    verification.status = { is_verified: true, status: 'approved' };
    renderYou();
    await screen.findByTestId('you-row-value-albums');
    const page = screen.getByTestId('you-rows-page');
    // The avatar renders a photo; everything else must use theme tokens.
    expect(hardcodedColourClasses(page, (el) => el.closest('[data-testid="you-avatar-ring"]') !== null)).toEqual([]);
    for (const l of BOARD_ORDER) {
      expect(contrast(screen.getByText(l), theme), `${l} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
    for (const id of ['albums', 'discretion', 'two-factor']) {
      expect(contrast(screen.getByTestId(`you-row-value-${id}`), theme)).toBeGreaterThanOrEqual(4.5);
    }
    for (const id of ['quiet-hours', 'merch', 'brands']) {
      const tag = screen.getByTestId(`you-row-soon-${id}`);
      expect(contrast(tag, theme), `tag ${id} (${theme})`).toBeGreaterThanOrEqual(4.5);
      // Brand / QC / Pete: small and muted. Thin low-contrast outline, muted text, not copper,
      // so it does not read as a button. Font stays 15px (lock); quiet comes from padding,
      // weight and colour.
      expect(tag.className).toMatch(/\bborder border-\[var\(--border-default\)\]/);
      expect(tag.className).toMatch(/text-\[var\(--cream-muted\)\]/);
      expect(tag.className).toMatch(/\bfont-medium\b/);
      expect(tag.className).not.toMatch(/font-(semibold|bold|extrabold)|\bpy-|px-(3|4)|copper|accent/);
      const outline = tokenContrast('var(--border-default)', 'var(--bg-card)', theme);
      const text = tokenContrast('var(--cream-muted)', 'var(--bg-card)', theme);
      expect(outline, `outline quieter than text (${theme})`).toBeLessThan(text);
    }
    for (const r of [...YOU_ROW_CARDS[0], ...YOU_ROW_CARDS[1]]) {
      expect(contrast(screen.getByTestId(`you-row-icon-${r.id}`), theme), `icon ${r.id}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(screen.getByText('ID verified'), theme)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(screen.getByText('Sign out'), theme)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(screen.getByTestId('you-edit'), theme)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('You locks: type, tap targets, copy, avatar', () => {
  const you = read('./You.tsx');
  const cfg = read('../lib/youRows.ts');

  it('every text size is at least 15px (Coming soon tag included)', () => {
    const sizes = Array.from(you.matchAll(/text-\[(\d+)px\]/g)).map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(15);
    expect(you).not.toMatch(/\btext-(xs|sm)\b/);
    expect(you).toMatch(/data-testid=\{`you-row-soon-\$\{row\.id\}`\}/);
    const tagClass = you.slice(you.lastIndexOf('className="', you.indexOf('you-row-soon-')), you.indexOf('you-row-soon-'));
    expect(tagClass).toMatch(/text-\[15px\]/);
  });

  it('rows, Edit, Sign out and Close are at least 44px tall', () => {
    expect(you).toMatch(/const rowClass =\s*'flex min-h-\[60px\]/);
    expect(you).toMatch(/inline-flex min-h-\[44px\][^"]*"\s*data-testid="you-edit"/);
    expect(you).toMatch(/inline-flex min-h-\[44px\][^"]*"\s*data-testid="you-sign-out"/);
    expect(you).toMatch(/flex h-11 w-11 items-center justify-center rounded-full/);
  });

  it('no "beta" and no em dashes in You copy', () => {
    for (const s of [you, cfg]) {
      expect(s).not.toMatch(/beta/i);
      expect(s).not.toContain('\u2014');
    }
  });

  it('an empty avatar uses the brand placeholder', async () => {
    api.getMe.mockResolvedValue({ data: { name: 'Dan', photo_url: '' } });
    renderYou();
    expect(await screen.findByTestId('you-avatar-brand-face')).toBeInTheDocument();
  });

  it('the page fits 360px and 390px without fixed widths', () => {
    expect(you).toMatch(/mx-auto w-full min-w-0 max-w-xl/);
    expect(you).toMatch(/min-w-0 flex-1 truncate/);
    expect(you).not.toMatch(/\bw-\[(3[7-9]\d|[4-9]\d\d)px\]/);
  });
});

describe('Discretion sheet keyboard (QC #385)', () => {
  async function openSheet() {
    renderYou();
    await screen.findByTestId('you-row-value-discretion');
    const trigger = screen.getByTestId('you-row-discretion');
    trigger.focus();
    fireEvent.click(trigger);
    const sheet = screen.getByTestId('you-discretion-sheet');
    await waitFor(() => expect(within(sheet).getByTestId('map-discretion-range')).not.toBeDisabled());
    return { trigger, sheet };
  }

  it('moves focus into the sheet on open', async () => {
    const { sheet } = await openSheet();
    expect(within(sheet).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('Escape closes it and returns focus to the Discretion row', async () => {
    const { trigger, sheet } = await openSheet();
    fireEvent.keyDown(within(sheet).getByTestId('map-discretion-range'), { key: 'Escape' });
    expect(screen.queryByTestId('you-discretion-sheet')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(api.setMapPinFuzz).not.toHaveBeenCalled();
  });

  it('Close returns focus to the Discretion row', async () => {
    const { trigger, sheet } = await openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('you-discretion-sheet')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps Tab and Shift+Tab inside the sheet', async () => {
    const { sheet } = await openSheet();
    const close = within(sheet).getByRole('button', { name: 'Close' });
    const range = within(sheet).getByTestId('map-discretion-range');
    // The backdrop is not a tab stop.
    expect(within(sheet).getByRole('button', { name: 'Close Discretion' })).toHaveAttribute('tabindex', '-1');
    // Shift+Tab on the first stop wraps to the last.
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    const focusables = Array.from(
      sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => el.getAttribute('tabindex') !== '-1');
    const last = focusables[focusables.length - 1];
    expect(last).toHaveFocus();
    // Tab on the last stop wraps to the first.
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();
    expect(focusables).toContain(range);
    expect(screen.getByTestId('you-discretion-sheet')).toBeInTheDocument();
  });
});

describe('You header name (QC #385 P0)', () => {
  it('the photo is the board ~84px and the name is never truncated', () => {
    const you = read('./You.tsx');
    expect(YOU_AVATAR_PX).toBe(84);
    const nameTag = you.slice(you.indexOf('<h2'), you.indexOf('data-testid="you-name"'));
    expect(nameTag).not.toMatch(/truncate|line-clamp|text-ellipsis|nowrap/);
    expect(nameTag).toMatch(/break-words/);
  });

  it('shows the whole long name', async () => {
    api.getMe.mockResolvedValue({ data: { name: 'Torbay Bear Featherstonehaugh', photo_url: '/uploads/dan.jpg' } });
    renderYou();
    await waitFor(() => expect(screen.getByTestId('you-name')).toHaveTextContent('Torbay Bear Featherstonehaugh'));
    expect(screen.getByTestId('you-name').className).not.toMatch(/truncate/);
  });

  it('fits to two lines, stepping down 1px, never below 15px', () => {
    expect(YOU_NAME_MAX_PX).toBe(24);
    expect(YOU_NAME_MIN_PX).toBe(15);
    // Fits on two lines at the full size.
    expect(fitNameSize(() => 2)).toBe(24);
    // Needs three lines until 20px.
    expect(fitNameSize((px) => (px > 20 ? 3 : 2))).toBe(20);
    // Never fits: floor at 15px (wraps further rather than truncate).
    const tried: number[] = [];
    expect(fitNameSize((px) => { tried.push(px); return 4; })).toBe(15);
    expect(Math.min(...tried)).toBeGreaterThanOrEqual(15);
  });
});

describe('Get verified destination (QC #385)', () => {
  it('old /verify/* links land on /profile/edit#verify', () => {
    expect(VERIFY_HOME_PATH).toBe('/profile/edit#verify');
    const app = read('../App.tsx');
    expect(app).toMatch(/path="\/verify\/\*" element=\{<ProtectedRoute><Navigate to=\{VERIFY_HOME_PATH\} replace \/><\/ProtectedRoute>\}/);
    expect(app).not.toMatch(/path="\/verify\/\*"[^\n]*to="\/profile"/);
  });

  it('a /verify/id visit redirects to the Edit screen Verify section', async () => {
    const { Navigate } = await import('react-router-dom');
    render(
      <MemoryRouter initialEntries={['/verify/id']}>
        <PathSpy />
        <Routes>
          <Route path="/verify/*" element={<Navigate to={VERIFY_HOME_PATH} replace />} />
          <Route path="/profile/edit" element={<p>edit</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('edit')).toBeInTheDocument();
    expect(lastPath).toBe('/profile/edit#verify');
  });

  it('the Veriff return URL in the backend is /profile/edit#verify', () => {
    const svc = read('../../../backend/src/services/veriff.service.ts');
    expect(svc).toContain("VERIFF_RETURN_PATH = '/profile/edit#verify'");
    expect(svc).toMatch(/callback: veriffCallbackUrl\(\)/);
  });
});
