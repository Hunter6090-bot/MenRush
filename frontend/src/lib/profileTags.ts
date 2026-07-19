import { DISCOVERY_FILTER_CATEGORIES } from './discoveryFilters';

/** Tag groups for profile editor and setup — aligned with discovery filters. */
export const PROFILE_TAG_GROUPS = DISCOVERY_FILTER_CATEGORIES.map((category) => ({
  label: category.label,
  tags: category.tags.filter((tag) => tag !== 'All'),
  singleSelect: 'singleSelect' in category && category.singleSelect === true,
}));

export const PROFILE_LOOKING_FOR_TAGS =
  DISCOVERY_FILTER_CATEGORIES.find((c) => c.id === 'looking_for')?.tags.filter((t) => t !== 'All') ?? [];

export function toggleProfileInterest(
  interests: string[],
  tag: string,
  group: { tags: readonly string[]; singleSelect?: boolean },
  maxTags = 10,
): string[] {
  if (interests.includes(tag)) {
    return interests.filter((t) => t !== tag);
  }

  let next = interests;
  if (group.singleSelect) {
    const groupTags = new Set(group.tags);
    next = interests.filter((t) => !groupTags.has(t));
  }

  if (next.length >= maxTags) return interests;
  return [...next, tag];
}