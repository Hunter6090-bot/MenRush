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
import { ACCOUNT_MENU_FOOTER_LINKS, ACCOUNT_MENU_SECTIONS } from '../components/AccountMenu';

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

  it('Settings anchors used by the Menu exist', () => {
    const settings = src('pages/Settings.tsx');
    for (const section of ACCOUNT_MENU_SECTIONS) {
      for (const l of section.links) {
        const hash = l.to?.split('#')[1];
        if (hash) expect(settings).toContain(`id="${hash}"`);
      }
    }
  });

  it('Menu copy follows the locks', () => {
    const labels = [
      ...ACCOUNT_MENU_SECTIONS.flatMap((s) => [s.title, ...s.links.map((l) => l.label)]),
      ...ACCOUNT_MENU_FOOTER_LINKS.map((l) => l.label),
    ].join(' ');
    expect(labels).not.toMatch(/beta/i);
    expect(labels).not.toMatch(/\u2014/);
    expect(labels).not.toMatch(/ghost/i);
  });
});
