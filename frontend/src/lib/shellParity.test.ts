/**
 * Pete (8 Oct 2026): nobody loses access to anything because of the new design.
 *
 * Every logged-in route that main (393858d) reached from its nav, header,
 * Settings, You page or cards must be linked from the new shell: a bottom
 * tab, the header, the top-right Menu, or a pinned row on a tab screen
 * (Chat > Matches, Out > Community / Events / Cruise).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getNavItems } from './navConfig';
import { ACCOUNT_MENU_FOOTER_LINKS, ACCOUNT_MENU_LINKS, ACCOUNT_MENU_SECTIONS } from '../components/AccountMenu';

const src = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

/** Route -> where main exposed it (for the audit table). */
const MAIN_ROUTES: Record<string, string> = {
  '/discover': 'tab Nearby',
  '/stream': 'tab Community',
  '/conversations': 'tab Chat',
  '/matches': 'tab Matches',
  '/rooms': 'tab Rooms',
  '/profile': 'tab Profile',
  '/events': 'More / desktop sidebar',
  '/settings': 'More / desktop sidebar / You cog',
  '/notifications': 'header bell, Settings Activity',
  '/hot-spots': 'map Cruise layer, Events page',
  '/albums': 'You > Albums card',
  '/premium': 'sidebar promo, Settings Membership',
  '/settings#blocked': 'You > Blocked card',
  '/settings#account': 'Settings > Account (email, password, ID, 2FA)',
  '/profile#ghost': 'You > Ghost mode card',
  '/profile#privacy': 'Settings > Privacy & visibility -> You (location, visibility)',
  '/profile#viewed-me': 'You > Who viewed you',
  '/profile#invite': 'You > Referrals card',
  '/profile#mood': 'You > Mood card',
  '/settings#delete-account': 'Settings > Delete account',
  '/help': 'Settings About',
  '/safety': 'Settings Safety',
  '/terms': 'Settings About',
  '/privacy': 'Settings About',
  '/guidelines': 'Settings About',
  '/cookies': 'site footer',
  '/contact': 'site footer',
  '/get-the-app': 'install prompt',
};

function shellRoutes(): Set<string> {
  const routes = new Set<string>();
  for (const item of getNavItems()) if (item.mobileTab) routes.add(item.to);
  for (const section of ACCOUNT_MENU_SECTIONS) for (const l of section.links) if (l.to) routes.add(l.to);
  for (const l of ACCOUNT_MENU_FOOTER_LINKS) if (l.to) routes.add(l.to);

  const literalLinks = (file: string) => {
    const text = src(file);
    for (const m of text.matchAll(/(?:to=|navigate\()["'`](\/[^"'`]*)["'`]/g)) routes.add(m[1]);
  };
  literalLinks('components/Layout.tsx'); // header bell
  literalLinks('components/ConversationList.tsx'); // Chat > Matches
  literalLinks('pages/Out.tsx'); // Out > Community, Events, Cruise
  return routes;
}

describe('new shell keeps every main route reachable', () => {
  const routes = shellRoutes();
  for (const [route, wasOnMain] of Object.entries(MAIN_ROUTES)) {
    it(`${route} (main: ${wasOnMain})`, () => {
      expect(routes.has(route)).toBe(true);
    });
  }

  it('Menu links point at real routes in App.tsx', () => {
    const app = src('App.tsx');
    const paths = new Set(Array.from(app.matchAll(/path="([^"]+)"/g)).map((m) => m[1]));
    for (const section of ACCOUNT_MENU_SECTIONS) {
      for (const l of section.links) {
        if (!l.to) continue;
        expect(paths.has(l.to.split('#')[0])).toBe(true);
      }
    }
    for (const l of ACCOUNT_MENU_FOOTER_LINKS) if (l.to) expect(paths.has(l.to)).toBe(true);
  });

  it('Settings and You page anchors used by the Menu exist', () => {
    const pages: Record<string, string> = {
      '/settings': src('pages/Settings.tsx'),
      '/profile': src('pages/Profile.tsx'),
    };
    for (const section of ACCOUNT_MENU_SECTIONS) {
      for (const l of section.links) {
        if (!l.to?.includes('#')) continue;
        const [path, hash] = l.to.split('#');
        expect(pages[path], `${l.to} has no page source in this test`).toBeDefined();
        expect(pages[path]).toContain(`id="${hash}"`);
      }
    }
  });

  it('Profile anchors sit on the right cards', () => {
    const profile = src('pages/Profile.tsx');
    expect(profile).toMatch(/<div id="ghost">\s*<GhostToggle/);
    expect(profile).toMatch(/<div id="viewed-me">\s*<ProfileViewersCard/);
    expect(profile).toMatch(/<div id="invite">\s*<ReferralCard/);
    expect(profile).toMatch(/id="mood"[\s\S]{0,400}>Mood</);
    expect(profile).toMatch(/id="privacy"[\s\S]{0,400}>Your location</);
  });

  it('Ghost mode is a link to the existing card, not a new toggle', () => {
    const ghost = ACCOUNT_MENU_LINKS.filter((l) => /ghost/i.test(l.label));
    expect(ghost).toEqual([{ id: 'ghost', label: 'Ghost mode', to: '/profile#ghost' }]);
    expect(src('components/AccountMenu.tsx')).not.toMatch(/GhostToggle|setGhost|ghostAPI/);
  });

  it('privacy rows are labelled for where they go', () => {
    const byId = Object.fromEntries(ACCOUNT_MENU_LINKS.map((l) => [l.id, l]));
    expect(byId['account-security']).toMatchObject({ label: 'Account and security', to: '/settings#account' });
    expect(byId['privacy-visibility']).toMatchObject({ label: 'Privacy and visibility', to: '/profile#privacy' });
    expect(ACCOUNT_MENU_LINKS.some((l) => l.label === 'Privacy and security')).toBe(false);
  });

  it('app-wide search is off the map, in the Menu and still on the Chat list', () => {
    // Map is clean: no Search pill in the top pill bar or on Discover.
    expect(src('components/MapTopPillBar.tsx')).not.toMatch(/map-pill-search|onSearchClick/);
    expect(src('pages/Discover.tsx')).not.toMatch(/menrush:open-search|onSearchClick/);
    // Top-right Menu has a Search row wired to the same profile search.
    expect(src('components/AccountMenu.tsx')).toMatch(/data-testid="account-menu-search"/);
    expect(src('components/Layout.tsx')).toMatch(/onSearch=\{\(\) => setSearchOpen\(true\)\}/);
    expect(src('components/Layout.tsx')).toMatch(/addEventListener\('menrush:open-search'/);
    // Chat list entry kept, so nothing is lost.
    expect(src('components/ConversationList.tsx')).toMatch(/dispatchEvent\(new Event\('menrush:open-search'\)\)/);
  });

  it('Menu copy follows the locks', () => {
    const labels = [
      ...ACCOUNT_MENU_SECTIONS.flatMap((s) => [s.title, ...s.links.map((l) => l.label)]),
      ...ACCOUNT_MENU_FOOTER_LINKS.map((l) => l.label),
    ].join(' ');
    expect(labels).not.toMatch(/beta/i);
    expect(labels).not.toMatch(/\u2014/);
    // Only "Ghost mode" may mention Ghost (a link to the existing card).
    expect(labels.replace('Ghost mode', '')).not.toMatch(/ghost/i);
  });
});
