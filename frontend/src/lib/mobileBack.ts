/** Routes with bottom-tab navigation — no in-app back needed on mobile. */
export const MOBILE_TAB_ROOTS = new Set([
  '/discover',
  '/matches',
  '/conversations',
  '/notifications',
  '/rooms',
]);

export function shouldShowMobileBack(pathname: string): boolean {
  return !MOBILE_TAB_ROOTS.has(pathname);
}

export function mobileBackFallback(pathname: string): string {
  if (pathname === '/albums') return '/profile';
  if (pathname.startsWith('/profile/')) return '/discover';
  if (pathname === '/profile') return '/discover';
  if (pathname === '/stream') return '/discover';
  if (pathname.startsWith('/messages/')) return '/conversations';
  if (pathname.startsWith('/rooms/')) return '/rooms';
  return '/discover';
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
