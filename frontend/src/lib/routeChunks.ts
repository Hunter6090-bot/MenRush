/**
 * Idle prefetch for logged-in shell routes that phones hit constantly.
 * Do NOT prefetch Discover/HotSpots here — that pulls mapbox-gl (~1.7MB) onto
 * every session even when the user stays in chat/profile.
 */
const APP_ROUTE_LOADERS: Array<() => Promise<unknown>> = [
  () => import('../pages/Matches'),
  () => import('../pages/Profile'),
  () => import('../components/MessagingRoute'),
  () => import('../components/RoomsRoute'),
  () => import('../pages/ProfileView'),
  () => import('../pages/Settings'),
  () => import('../pages/Notifications'),
];

let scheduled = false;

export function prefetchAppRouteChunks(): void {
  if (typeof window === 'undefined') return;
  if (scheduled) return;
  scheduled = true;

  const run = () => {
    for (const load of APP_ROUTE_LOADERS) {
      void load().catch(() => {
        /* prefetch is best-effort */
      });
    }
  };

  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;

  if (typeof ric === 'function') {
    ric(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 400);
  }
}

/** Test helper — reset module latch between vitest cases. */
export function resetPrefetchLatchForTests(): void {
  scheduled = false;
}
