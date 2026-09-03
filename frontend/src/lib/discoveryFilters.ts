import type { Mood } from '../api/client';
import { MOOD_LABELS } from '../api/client';
import type { NearbyUser } from '../components/ProfileCard';
import { INTENT_FILTERS, matchesIntentFilter, type IntentFilter } from './discoveryFormat';

/** Profile tag groups — shared with Profile editor. */
export const DISCOVERY_FILTER_CATEGORIES = [
  {
    id: 'looking_for',
    label: 'Looking for',
    singleSelect: true,
    tags: [
      'All',
      'Chat',
      'Drinks',
      'Date',
      'NSA',
      'Hookup',
      'Casual',
      'Dating',
      'FWB',
      'Discreet',
      'Hosting',
      'Can Travel',
      'Right Now',
    ],
  },
  {
    id: 'position',
    label: 'Position',
    tags: ['Top', 'Vers Top', 'Vers', 'Vers Bottom', 'Bottom', 'Side'],
  },
  {
    id: 'tribe',
    label: 'Tribe',
    tags: ['Twink', 'Twunk', 'Otter', 'Bear', 'Cub', 'Daddy', 'Wolf', 'Jock', 'Leather', 'Rugged', 'Geek'],
  },
  {
    id: 'body',
    label: 'Body',
    tags: ['Slim', 'Athletic', 'Muscular', 'Stocky', 'Chubby', 'Hairy', 'Smooth', 'Tatted'],
  },
  {
    id: 'ethnicity',
    label: 'Ethnicity',
    singleSelect: true,
    tags: [
      'Asian',
      'Black',
      'Latino',
      'Middle Eastern',
      'Mixed',
      'South Asian',
      'White',
      'Indigenous',
      'Other',
    ],
  },
  {
    id: 'vibe',
    label: 'Vibe',
    tags: ['Kinky', 'Vanilla', 'Open', 'Sober', 'PnP-Free'],
  },
  {
    id: 'scene',
    label: 'Scene',
    tags: ['Gym', 'Bar', 'Club', 'Sauna', 'Cruising', 'House Party', 'Coffee', 'Outdoors'],
  },
  {
    id: 'connection',
    label: 'Connection',
    tags: ['Friends', 'Networking', 'Group', 'Couples', 'Poly', 'Long-term', 'Short-term'],
  },
] as const;

export type DiscoveryFilterCategoryId = (typeof DISCOVERY_FILTER_CATEGORIES)[number]['id'];

/** Vibe / scene / connection live in the More filters drawer (not a new nav tab). */
export const MORE_FILTER_CATEGORY_IDS = ['vibe', 'scene', 'connection'] as const;

export type MoreFilterCategoryId = (typeof MORE_FILTER_CATEGORY_IDS)[number];

export function isMoreFilterCategoryId(id: string): id is MoreFilterCategoryId {
  return (MORE_FILTER_CATEGORY_IDS as readonly string[]).includes(id);
}

/** Categories shown in the inline Filters panel (Looking for, position, …). */
export const PRIMARY_DISCOVERY_FILTER_CATEGORIES = DISCOVERY_FILTER_CATEGORIES.filter(
  (category) => !isMoreFilterCategoryId(category.id),
);

export function getMoreFilterCategories() {
  return DISCOVERY_FILTER_CATEGORIES.filter((category) => isMoreFilterCategoryId(category.id));
}

export const API_LOOKING_FOR_INTENTS = new Set<string>(INTENT_FILTERS.filter((v) => v !== 'All'));

/** Discovery age filter floor/ceiling — everyone on the app is 18+. */
export const AGE_CLAMP_MIN = 18;
export const AGE_CLAMP_MAX = 99;

/** Every integer From/To option (18…99) for native `<select>`s. */
export const AGE_SELECT_OPTIONS: readonly number[] = Array.from(
  { length: AGE_CLAMP_MAX - AGE_CLAMP_MIN + 1 },
  (_, i) => AGE_CLAMP_MIN + i,
);

export const STATUS_FILTER_OPTIONS = [
  { id: 'online', label: 'Online now' },
  { id: 'pulsing', label: 'Pulsing now' },
  { id: 'hasPhoto', label: 'Has photo' },
  { id: 'verified', label: 'Trust checked' },
] as const;

export type StatusFilterId = (typeof STATUS_FILTER_OPTIONS)[number]['id'];

export const MOOD_FILTER_OPTIONS = Object.entries(MOOD_LABELS).map(([value, label]) => ({
  value: value as Mood,
  label,
}));

export interface DiscoveryFilterState {
  intent: string;
  interests: string[];
  /** Who-you-want-to-see lower bound (inclusive). Default 18. */
  ageFrom: number;
  /** Who-you-want-to-see upper bound (inclusive). Default 99. */
  ageTo: number;
  status: StatusFilterId[];
  mood?: Mood;
}

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilterState = {
  intent: 'All',
  interests: [],
  ageFrom: AGE_CLAMP_MIN,
  ageTo: AGE_CLAMP_MAX,
  status: [],
  mood: undefined,
};

export function clampAge(value: number): number {
  return Math.min(AGE_CLAMP_MAX, Math.max(AGE_CLAMP_MIN, Math.trunc(value)));
}

/** True when the range is narrower than the open 18–99 default. */
export function hasActiveAgeFilter(state: DiscoveryFilterState): boolean {
  return state.ageFrom !== AGE_CLAMP_MIN || state.ageTo !== AGE_CLAMP_MAX;
}

export function countActiveDiscoveryFilters(state: DiscoveryFilterState): number {
  let count = 0;
  if (state.intent !== 'All') count += 1;
  count += state.interests.length;
  if (hasActiveAgeFilter(state)) count += 1;
  count += state.status.length;
  if (state.mood) count += 1;
  return count;
}

export function countMoreFilterSelections(state: DiscoveryFilterState): number {
  const moreTags = new Set(
    getMoreFilterCategories().flatMap((category) => category.tags as readonly string[]),
  );
  return state.interests.filter((tag) => moreTags.has(tag)).length;
}

/** Resolved From–To for Nearby API + client filters. Always clamped 18–99; From ≤ To. */
export function resolveAgeRange(state: DiscoveryFilterState): { minAge: number; maxAge: number } {
  let minAge = clampAge(state.ageFrom);
  let maxAge = clampAge(state.ageTo);
  if (minAge > maxAge) {
    maxAge = minAge; // snap To up to From
  }
  return { minAge, maxAge };
}

/** Set From; if From > To, snap To up to From. */
export function withAgeFrom(state: DiscoveryFilterState, ageFrom: number): DiscoveryFilterState {
  const from = clampAge(ageFrom);
  const to = clampAge(state.ageTo);
  return {
    ...state,
    ageFrom: from,
    ageTo: from > to ? from : to,
  };
}

/** Set To; if From > To, snap To up to From. */
export function withAgeTo(state: DiscoveryFilterState, ageTo: number): DiscoveryFilterState {
  const from = clampAge(state.ageFrom);
  const to = clampAge(ageTo);
  return {
    ...state,
    ageFrom: from,
    ageTo: from > to ? from : to,
  };
}

/** Set both ends at once (clamped; To snapped up if inverted). */
export function withAgeRange(
  state: DiscoveryFilterState,
  ageFrom: number,
  ageTo: number,
): DiscoveryFilterState {
  const from = clampAge(ageFrom);
  const to = clampAge(ageTo);
  return {
    ...state,
    ageFrom: from,
    ageTo: from > to ? from : to,
  };
}

/** Tags sent to `/users/nearby` interests overlap filter. */
export function buildInterestTags(state: DiscoveryFilterState): string[] | undefined {
  const tags = [...state.interests];
  if (state.intent !== 'All' && !API_LOOKING_FOR_INTENTS.has(state.intent)) {
    tags.push(state.intent);
  }
  const unique = [...new Set(tags)];
  return unique.length > 0 ? unique : undefined;
}

export function buildLookingForParam(state: DiscoveryFilterState): string | undefined {
  if (state.intent === 'All') return undefined;
  if (API_LOOKING_FOR_INTENTS.has(state.intent)) return state.intent.toLowerCase();
  return undefined;
}

export function buildNearbyApiFilters(state: DiscoveryFilterState) {
  const { minAge, maxAge } = resolveAgeRange(state);
  return {
    interests: buildInterestTags(state),
    lookingFor: buildLookingForParam(state),
    minAge,
    maxAge,
    onlyPulse: state.status.includes('pulsing') || undefined,
    mood: state.mood ? `%${state.mood}%` : undefined,
  };
}

export function applyDiscoveryClientFilters(users: NearbyUser[], state: DiscoveryFilterState): NearbyUser[] {
  let result = users;

  if (state.intent !== 'All') {
    if (API_LOOKING_FOR_INTENTS.has(state.intent)) {
      result = result.filter((u) => matchesIntentFilter(u, state.intent as IntentFilter));
    } else {
      const needle = state.intent.toLowerCase();
      result = result.filter((u) => {
        const interests = (u.interests ?? []).map((t) => t.toLowerCase());
        const lookingFor = ((u as NearbyUser & { looking_for?: string }).looking_for ?? '').toLowerCase();
        const mood = (u.mood ?? '').toLowerCase();
        return interests.includes(needle) || lookingFor.includes(needle) || mood.includes(needle);
      });
    }
  }

  if (state.status.includes('online')) {
    result = result.filter((u) => u.online);
  }
  if (state.status.includes('hasPhoto')) {
    result = result.filter((u) => !!u.photo_url);
  }
  if (state.status.includes('verified')) {
    // One badge only — Veriff is_verified / identity_checked. No Authentic-person honor mark.
    result = result.filter((u) => u.is_verified);
  }

  const { minAge, maxAge } = resolveAgeRange(state);
  if (minAge != null) result = result.filter((u) => typeof u.age === 'number' && u.age >= minAge);
  if (maxAge != null) result = result.filter((u) => typeof u.age === 'number' && u.age <= maxAge);
  // Hard floor: never surface under-18 even if a bad age slips through.
  result = result.filter((u) => u.age == null || u.age >= AGE_CLAMP_MIN);

  if (state.interests.length > 0) {
    result = result.filter((u) => {
      const userTags = new Set((u.interests ?? []).map((t) => t.toLowerCase()));
      return state.interests.every((tag) => userTags.has(tag.toLowerCase()));
    });
  }

  if (state.mood) {
    result = result.filter((u) => u.mood === state.mood);
  }

  return result;
}
