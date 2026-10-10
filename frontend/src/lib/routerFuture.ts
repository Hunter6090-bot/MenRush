/**
 * React Router v6 → v7 future flags (library / declarative BrowserRouter mode).
 *
 * On v6 these were passed to `<BrowserRouter future={…}>` so the version bump
 * would not change routing semantics. In React Router v7 they are defaults and
 * `BrowserRouter` no longer accepts these `future` keys (use `useTransitions`
 * only if you need to opt out of startTransition navigations).
 *
 * Kept as documentation of the staged upgrade path. Do not reintroduce the
 * prop on v7 — TypeScript will reject it.
 */
export const ROUTER_V7_FUTURE = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;
