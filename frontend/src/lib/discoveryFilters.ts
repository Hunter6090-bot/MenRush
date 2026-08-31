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
      'NSA',
      'Hookup',
      'Casual',
      'FWB',
      'Discreet',
      'Hosting',
      'Can Travel',
      'Right Now',
      'Oral',
      'Anal',
      'Rim',
      'JO',
      'Threesome',
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
    tags: [
      'Twink',
      'Twunk',
      'Otter',
      'Bear',
      'Cub',
      'Daddy',
      'Wolf',
      'Jock',
      'Leather',
      'Rugged',
      'Geek',
      'Pup',
      'Chub',
      'Muscle',
    ],
  },
  {
    id: 'body',
    label: 'Body',
    tags: [
      'Slim',
      'Athletic',
      'Muscular',
      'Stocky',
      'Chubby',
      'Hairy',
      'Smooth',
      'Tatted',
      'Average',
      'Toned',
      'Large',
      'Dad bod',
    ],
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
    tags: [
      'Kinky',
      'Vanilla',
      'Horny',
      'Filthy',
      'Rough',
      'Oral',
      'Anal',
      'Rim',
      'JO',
      'Dominant',
      'Submissive',
      'Sober',
      'PnP-Free',
    ],
  },
  {
    id: 'scene',
    label: 'Scene',
    tags: [
      'Sauna',
      'Cruising',
      'Darkroom',
      'Glory hole',
      'Hotel',
      'Private',
      'Club',
      'After hours',
      'Car',
      'Toilets',
      'House Party',
      'Gym',
      'Bar',
    ],
  },
  {
    id: 'connection',
    label: 'Connection',
    tags: [
      'Group',
      'Couples',
      'Poly',
      'Threesome',
      'Gangbang',
      'Cam',
      'Overnight',
      'Host',
      'Travel',
      'Now',
      'Short-term',
    ],
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

export const AGE_PRESETS = [
  { id: 'any', label: 'Any age', min: undefined as number | undefined, max: undefined as number | undefined },
  { id: '18-21', label: '18–21', min: 18, max: 21 },
  { id: '22-29', label: '22–29', min: 22, max: 29 },
  { id: '30-39', label: '30–39', min: 30, max: 39 },
  { id: '40-49', label: '40–49', min: 40, max: 49 },
  /** Once 60+ exists, 50+ means 50–59 (not 50–99). */
  { id: '50+', label: '50–59', min: 50, max: 59 },
  { id: '60+', label: '60+', min: 60, max: 99 },
] as const;

export type AgePresetId = (typeof AGE_PRESETS)[number]['id'];

export const AGE_CLAMP_MIN = 18;
export const AGE_CLAMP_MAX = 99;

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
  agePreset: AgePresetId;
  /** Custom age bounds; when set, presets are deselected (agePreset = any). */
  customAgeMin?: number;
  customAgeMax?: number;
  status: StatusFilterId[];
  mood?: Mood;
}

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilterState = {
  intent: 'All',
  interests: [],
  agePreset: 'any',
  customAgeMin: undefined,
  customAgeMax: undefined,
  status: [],
  mood: undefined,
};

export function clampAge(value: number): number {
  return Math.min(AGE_CLAMP_MAX, Math.max(AGE_CLAMP_MIN, Math.trunc(value)));
}

export function hasCustomAge(state: DiscoveryFilterState): boolean {
  return state.customAgeMin != null || state.customAgeMax != null;
}

export function hasActiveAgeFilter(state: DiscoveryFilterState): boolean {
  return hasCustomAge(state) || state.agePreset !== 'any';
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

export function getAgeRange(presetId: AgePresetId): { minAge?: number; maxAge?: number } {
  const preset = AGE_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.id === 'any') return {};
  return { minAge: preset.min, maxAge: preset.max };
}

/** Prefer custom min/max when present; otherwise use the selected preset. */
export function resolveAgeRange(state: DiscoveryFilterState): { minAge?: number; maxAge?: number } {
  if (hasCustomAge(state)) {
    let minAge = state.customAgeMin;
    let maxAge = state.customAgeMax;
    if (minAge != null && maxAge != null && minAge > maxAge) {
      [minAge, maxAge] = [maxAge, minAge];
    }
    return { minAge, maxAge };
  }
  return getAgeRange(state.agePreset);
}

/** Selecting a preset clears custom age. */
export function withAgePreset(state: DiscoveryFilterState, agePreset: AgePresetId): DiscoveryFilterState {
  return {
    ...state,
    agePreset,
    customAgeMin: undefined,
    customAgeMax: undefined,
  };
}

/** Setting custom age deselects presets (agePreset → any). Values are clamped 18–99. */
export function withCustomAge(
  state: DiscoveryFilterState,
  customAgeMin?: number,
  customAgeMax?: number,
): DiscoveryFilterState {
  return {
    ...state,
    agePreset: 'any',
    customAgeMin: customAgeMin == null || Number.isNaN(customAgeMin) ? undefined : clampAge(customAgeMin),
    customAgeMax: customAgeMax == null || Number.isNaN(customAgeMax) ? undefined : clampAge(customAgeMax),
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
    result = result.filter((u) => u.is_verified || u.authenticity_status === 'verified');
  }

  const { minAge, maxAge } = resolveAgeRange(state);
  if (minAge != null) result = result.filter((u) => u.age >= minAge);
  if (maxAge != null) result = result.filter((u) => u.age <= maxAge);

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
