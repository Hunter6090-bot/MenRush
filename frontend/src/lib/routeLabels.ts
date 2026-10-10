/** Shared route/surface labels — mobile header, desktop workspace, and in-page copy must match. */
export const ROUTE_LABELS = {
  nearby: 'Nearby',
  map: 'Map',
  out: 'Out',
  you: 'You',
  community: 'Community',
  /** @deprecated Use `community` — Live profile list was replaced by Community Space. */
  liveProfileList: 'Community',
  matches: 'Matches',
  messages: 'Messages',
  /** Tab and desktop sidebar name for /conversations (board). */
  chat: 'Chat',
  alerts: 'Alerts',
  profile: 'Profile',
  rooms: 'Rooms',
  events: 'Events',
  /** User-facing name is Cruise; `/hot-spots` route + API stay for compatibility. */
  hotSpots: 'Cruise',
  settings: 'Settings',
} as const;
