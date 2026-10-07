import { describe, expect, it } from 'vitest';
import { getNavItems, isNavActive, mobilePageTitle } from './navConfig';
import { ROUTE_LABELS } from './routeLabels';
import { IconOut, IconRooms } from '../components/icons';

describe('navConfig — redesign Step 1 five-tab shell', () => {
  it('exposes Discover home + Chat · Rooms · Out · You as the only mobile tabs', () => {
    const items = getNavItems();
    const mobileOrder = items.filter((i) => i.mobileTab).map((i) => i.to);
    expect(mobileOrder).toEqual([
      '/discover',
      '/conversations',
      '/rooms',
      '/out',
      '/profile',
    ]);

    const map = items.find((i) => i.to === '/discover');
    // Catalog label stays Map; bottom-tab slot is a Map|List toggle in Layout.
    expect(map?.shortLabel).toBe('Map');
    expect(map?.label).toBe(ROUTE_LABELS.map);
    expect(map?.to).toBe('/discover');

    const chat = items.find((i) => i.to === '/conversations');
    expect(chat?.shortLabel).toBe('Chat');

    const rooms = items.find((i) => i.to === '/rooms');
    expect(rooms?.shortLabel).toBe('Rooms');
    expect(rooms?.label).toBe(ROUTE_LABELS.rooms);

    const out = items.find((i) => i.to === '/out');
    expect(out?.shortLabel).toBe('Out');
    expect(out?.mobileTab).toBe(true);
    expect(out?.Icon).toBe(IconOut);
    expect(items.find((i) => i.to === '/rooms')?.Icon).toBe(IconRooms);

    const you = items.find((i) => i.to === '/profile');
    expect(you?.shortLabel).toBe('You');

    // Matches / Community leave the primary tab row but stay reachable.
    expect(items.find((i) => i.to === '/matches')?.mobileTab).toBeFalsy();
    expect(items.find((i) => i.to === '/stream')?.mobileTab).toBeFalsy();
  });


  it("Rooms tab shortLabel is Rooms (Video rooms lock retired)", () => {
    const rooms = getNavItems().find((i) => i.to === '/rooms' && i.mobileTab);
    expect(rooms).toBeTruthy();
    expect(rooms!.shortLabel).toBe('Rooms');
    expect(rooms!.label).toBe(ROUTE_LABELS.rooms);
    expect(rooms!.label).toBe('Rooms');
    expect(rooms!.shortLabel).not.toMatch(/Video/i);
  });

  it('keeps Chat and Rooms active states separate', () => {
    expect(isNavActive('/conversations', '/conversations')).toBe(true);
    expect(isNavActive('/messages/abc', '/conversations')).toBe(true);
    expect(isNavActive('/rooms', '/conversations')).toBe(false);
    expect(isNavActive('/rooms/xyz', '/conversations')).toBe(false);

    expect(isNavActive('/rooms', '/rooms')).toBe(true);
    expect(isNavActive('/rooms/xyz', '/rooms')).toBe(true);
    expect(isNavActive('/conversations', '/rooms')).toBe(false);
  });

  it('marks Out active for Cruise, Events, and Community deep links', () => {
    expect(isNavActive('/out', '/out')).toBe(true);
    expect(isNavActive('/hot-spots', '/out')).toBe(true);
    expect(isNavActive('/events', '/out')).toBe(true);
    expect(isNavActive('/stream', '/out')).toBe(true);
  });

  it('titles room and map surfaces with short labels', () => {
    expect(mobilePageTitle('/rooms')).toBe('Rooms');
    expect(mobilePageTitle('/rooms/abc')).toBe('Rooms');
    expect(mobilePageTitle('/discover')).toBe(ROUTE_LABELS.map);
    expect(mobilePageTitle('/conversations')).toBe('Chat');
    expect(mobilePageTitle('/messages/abc')).toBe('Chat');
    expect(mobilePageTitle('/out')).toBe(ROUTE_LABELS.out);
  });
});
