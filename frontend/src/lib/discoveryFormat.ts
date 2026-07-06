import type { NearbyUser } from '../components/ProfileCard';

const TRIBE_TAGS = [
  'Twink', 'Twunk', 'Otter', 'Bear', 'Cub', 'Daddy', 'Wolf', 'Jock', 'Leather', 'Rugged', 'Geek',
];

export const DESKTOP_RADIUS_MILES = [1, 5, 25] as const;
export type DesktopRadiusMiles = (typeof DESKTOP_RADIUS_MILES)[number];

export const INTENT_FILTERS = ['All', 'Chat', 'Drinks', 'Date', 'NSA'] as const;
export type IntentFilter = (typeof INTENT_FILTERS)[number];

export function formatRadiusMiles(km: number): string {
  const match = DESKTOP_RADIUS_MILES.find((m) => m === km);
  if (match) return `${match} mile${match === 1 ? '' : 's'}`;
  return `${km} km`;
}

export function formatDistanceMiles(user: NearbyUser): string {
  const km = Number(user.distance_km ?? 0);
  if (!Number.isFinite(km) || km <= 0) return 'Nearby';
  const miles = km * 0.621371;
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatActiveStatus(user: NearbyUser): string {
  if (user.online) return 'Active now';
  if (!user.last_seen) return 'Recently';
  const diffMs = Date.now() - new Date(user.last_seen).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Active now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Recently';
}

export function getTribeTag(user: NearbyUser): string {
  const interests = user.interests ?? [];
  const tribe = interests.find((tag) => TRIBE_TAGS.includes(tag));
  return tribe ?? interests[0] ?? 'Nearby';
}

export function matchesIntentFilter(user: NearbyUser, filter: IntentFilter): boolean {
  if (filter === 'All') return true;
  const mood = (user.mood ?? '').toLowerCase();
  const lookingFor = ((user as NearbyUser & { looking_for?: string }).looking_for ?? '').toLowerCase();
  const interests = (user.interests ?? []).map((t) => t.toLowerCase());

  switch (filter) {
    case 'Chat':
      return user.online || mood.includes('chat') || interests.includes('chat');
    case 'Drinks':
      return mood.includes('drink') || lookingFor.includes('drink') || interests.includes('drinks');
    case 'Date':
      return lookingFor.includes('dat') || mood.includes('date') || interests.includes('dating');
    case 'NSA':
      return lookingFor.includes('nsa') || mood.includes('nsa') || interests.includes('nsa');
    default:
      return true;
  }
}
