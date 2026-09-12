/**
 * React Router v6 → v7 future flags (library / declarative BrowserRouter mode).
 * Enable on v6 before bumping so the v7 jump is a no-op for these behaviors.
 * In v7 these become defaults; the prop remains harmless if passed.
 */
export const ROUTER_V7_FUTURE = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;
