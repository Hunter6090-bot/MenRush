import type { ComponentType } from 'react';
import { FEATURES } from './featureFlags';
import { IconChat, IconDiscover, IconMatches, IconNotifications, IconProfile, IconRooms } from '../components/icons';

export type NavIcon = ComponentType<{ size?: number; className?: string }>;

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  Icon: NavIcon;
  badgeKey?: 'messages' | 'notifications';
  mobileTab?: boolean;
  desktopNav?: boolean;
}

export function getNavItems(): NavItem[] {
  const items: NavItem[] = [
    {
      to: '/discover',
      label: 'Nearby',
      Icon: IconDiscover,
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/matches',
      label: 'Matches',
      Icon: IconMatches,
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/conversations',
      label: 'Messages',
      shortLabel: 'Chat',
      Icon: IconChat,
      badgeKey: 'messages',
      mobileTab: true,
      desktopNav: true,
    },
  ];

  if (FEATURES.chatRooms) {
    items.push({
      to: '/rooms',
      label: 'Rooms',
      Icon: IconRooms,
      desktopNav: true,
    });
  }

  items.push(
    {
      to: '/notifications',
      label: 'Alerts',
      Icon: IconNotifications,
      badgeKey: 'notifications',
      mobileTab: true,
      desktopNav: true,
    },
    {
      to: '/profile',
      label: 'Profile',
      Icon: IconProfile,
      mobileTab: true,
      desktopNav: true,
    },
  );

  return items;
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
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function mobilePageTitle(pathname: string): string {
  if (pathname.startsWith('/messages/')) return 'Chat';
  if (pathname.startsWith('/profile/')) return 'Profile';
  if (pathname.startsWith('/rooms/')) return 'Room';

  const items = getNavItems();
  const match = items.find((item) => isNavActive(pathname, item.to));
  if (match) return match.label;

  if (pathname === '/albums') return 'Albums';
  if (pathname === '/premium') return 'Premium';
  if (pathname === '/stream') return 'Live list';
  return 'MenRush';
}
