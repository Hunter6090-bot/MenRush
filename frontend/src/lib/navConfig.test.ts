import { describe, expect, it } from 'vitest';
import { getNavItems, isNavActive, mobilePageTitle } from './navConfig';
import { ROUTE_LABELS } from './routeLabels';

describe('navConfig: Rooms first-class chrome', () => {
  it('exposes Rooms as a primary mobile + desktop item next to Chat', () => {
    const items = getNavItems();
    const chat = items.find((i) => i.to === '/conversations');
    const rooms = items.find((i) => i.to === '/rooms');

    expect(chat?.shortLabel).toBe('Chat');
    expect(chat?.mobileTab).toBe(true);
    expect(chat?.desktopNav).toBe(true);

    expect(rooms?.label).toBe(ROUTE_LABELS.rooms);
    expect(rooms?.label).toBe('Rooms');
    expect(rooms?.label).not.toMatch(/Video/i);
    expect(rooms?.shortLabel).toBeUndefined();
    expect(rooms?.mobileTab).toBe(true);
    expect(rooms?.desktopNav).toBe(true);
    expect(rooms?.mobileMore).toBeFalsy();

    const mobileOrder = items.filter((i) => i.mobileTab).map((i) => i.to);
    expect(mobileOrder.indexOf('/conversations')).toBeLessThan(mobileOrder.indexOf('/rooms'));
    expect(mobileOrder).toEqual([
      '/discover',
      '/stream',
      '/conversations',
      '/matches',
      '/rooms',
      '/profile',
    ]);
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

  it('titles room surfaces Rooms, not a nested Chat label', () => {
    expect(mobilePageTitle('/rooms')).toBe('Rooms');
    expect(mobilePageTitle('/rooms/abc')).toBe('Rooms');
    expect(mobilePageTitle('/conversations')).toBe(ROUTE_LABELS.messages);
    expect(mobilePageTitle('/messages/abc')).toBe('Chat');
  });
});
