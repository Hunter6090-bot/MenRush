/** Shared route/surface labels — mobile header, desktop workspace, and in-page copy must match. */
export const ROUTE_LABELS = {
  nearby: 'Nearby',
  map: 'Map',
  community: 'Community',
  /** @deprecated Use `community` — Live profile list was replaced by Community Space. */
  liveProfileList: 'Community',
  matches: 'Matches',
  messages: 'Messages',
  alerts: 'Alerts',
  profile: 'Profile',
  rooms: 'Video rooms',
  events: 'Events',
  /** User-facing name is Cruise; `/hot-spots` route + API stay for compatibility. */
  hotSpots: 'Cruise',
  settings: 'Settings',
} as const;
