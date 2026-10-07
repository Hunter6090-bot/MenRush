import type { ComponentType } from 'react';
import { ROUTE_LABELS } from './routeLabels';
import { readHomeView } from './homeView';
import {
  IconChat,
  IconCommunity,
  IconDiscover,
  IconEvents,
  IconHotSpots,
  IconMatches,
  IconNotifications,
  IconOut,
  IconProfile,
  IconRooms,
  IconSettings,
} from '../components/icons';

export type NavIcon = ComponentType<{ size?: number; className?: string; filled?: boolean }>;

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  Icon: NavIcon;
  badgeKey?: 'messages' | 'notifications' | 'matches';
  mobileTab?: boolean;
  desktopNav?: boolean;
  /** Reachable on mobile via the "More" sheet instead of the primary tab row. */
  mobileMore?: boolean;
}

/**
 * Redesign Step 1 (Pete 6 Oct 2026): 5 primary tabs —
 * Home (Map|List toggle) · Chat · Rooms · Out · You.
 * Old destinations stay in the catalog for deep links / desktop Settings.
 */
export function getNavItems(): NavItem[] {
  return [
    {
      to: '/discover',
      label: ROUTE_LABELS.map,
      shortLabel: 'Map',
      Icon: IconDiscover,
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/conversations',
      label: ROUTE_LABELS.messages,
      shortLabel: 'Chat',
      Icon: IconChat,
      badgeKey: 'messages',
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/rooms',
      label: ROUTE_LABELS.rooms,
      shortLabel: 'Rooms',
      Icon: IconRooms,
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/out',
      label: ROUTE_LABELS.out,
      shortLabel: 'Out',
      Icon: IconOut,
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/profile',
      label: ROUTE_LABELS.you,
      shortLabel: 'You',
      Icon: IconProfile,
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/stream',
      label: ROUTE_LABELS.community,
      Icon: IconCommunity,
    },
    {
      to: '/events',
      label: ROUTE_LABELS.events,
      Icon: IconEvents,
    },
    {
      to: '/hot-spots',
      label: ROUTE_LABELS.hotSpots,
      Icon: IconHotSpots,
    },
    {
      to: '/matches',
      label: ROUTE_LABELS.matches,
      Icon: IconMatches,
      badgeKey: 'matches',
    },
    {
      to: '/settings',
      label: ROUTE_LABELS.settings,
      Icon: IconSettings,
      desktopNav: true,
    },
    {
      to: '/notifications',
      label: ROUTE_LABELS.alerts,
      Icon: IconNotifications,
      badgeKey: 'notifications',
    },
  ];
}

export function isNavActive(pathname: string, path: string): boolean {
  if (path === '/conversations') {
    return (
      pathname === '/conversations' ||
      pathname.startsWith('/conversations/') ||
      pathname.startsWith('/messages/')
    );
  }
  if (path === '/notifications') {
    return pathname === '/notifications';
  }
  if (path === '/profile') {
    return pathname === '/profile';
  }
  if (path === '/settings') {
    return pathname === '/settings';
  }
  if (path === '/events') {
    return pathname === '/events' || pathname.startsWith('/events/');
  }
  if (path === '/hot-spots') {
    return pathname === '/hot-spots' || pathname.startsWith('/hot-spots/');
  }
  if (path === '/stream') {
    return pathname === '/stream' || pathname.startsWith('/stream/');
  }
  if (path === '/out') {
    return (
      pathname === '/out' ||
      pathname.startsWith('/out/') ||
      pathname === '/events' ||
      pathname.startsWith('/events/') ||
      pathname === '/hot-spots' ||
      pathname.startsWith('/hot-spots/') ||
      pathname === '/stream' ||
      pathname.startsWith('/stream/')
    );
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function mobilePageTitle(pathname: string): string {
  if (pathname.startsWith('/messages/')) return 'Chat';
  if (pathname.startsWith('/profile/')) return 'Profile';
  if (pathname.startsWith('/rooms/')) return 'Rooms';
  if (pathname === '/out' || pathname.startsWith('/out/')) return ROUTE_LABELS.out;
  if (pathname === '/discover') return readHomeView() === 'list' ? 'List' : ROUTE_LABELS.map;

  const items = getNavItems();
  const match = items.find((item) => isNavActive(pathname, item.to));
  if (match) return match.shortLabel ?? match.label;

  if (pathname === '/albums') return 'Albums';
  if (pathname === '/premium') return 'Premium';
  if (pathname === '/stream') return ROUTE_LABELS.community;
  if (pathname === '/matches') return ROUTE_LABELS.matches;
  return 'MenRush';
}
