/** Primary mobile tabs — in-app back not shown (bottom nav is enough). */
export const MOBILE_TAB_ROOTS = new Set([
  '/discover',
  '/matches',
  '/conversations',
  '/profile',
]);

/** Home for signed-in users — Nearby / Discover. */
export const APP_HOME = '/discover';

export function shouldShowMobileBack(pathname: string): boolean {
  if (MOBILE_TAB_ROOTS.has(pathname)) return false;
  // Nested chat, setup, etc. always get a back control.
  return true;
}

export function mobileBackFallback(pathname: string): string {
  if (pathname === '/albums' || pathname === '/premium') return '/profile';
  if (pathname === '/settings' || pathname === '/notifications') return APP_HOME;
  if (pathname.startsWith('/profile/setup')) return APP_HOME;
  if (pathname.startsWith('/profile/')) return APP_HOME;
  if (pathname === '/stream' || pathname === '/events' || pathname === '/hot-spots') {
    return APP_HOME;
  }
  if (pathname.startsWith('/messages/')) return '/conversations';
  if (pathname.startsWith('/rooms/')) return '/rooms';
  if (pathname.startsWith('/verify')) return APP_HOME;
  return APP_HOME;
}

import type { NavigateFunction } from 'react-router-dom';

export function goBack(navigate: NavigateFunction, fallback: string): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === 'number' && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback);
}
