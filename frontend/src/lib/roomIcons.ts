/**
 * Room name or slug to Claude Design room icon.
 *
 * Official rooms are seeded with an official_slug (migration 034), so the
 * slug is tried first. Names are matched after normalising case, '&', 'and',
 * '/', '+' and punctuation, so "Kink & Pig", "Kink / Pig" and "kink and pig"
 * all map to the same icon. Matching is exact on the remaining words, so a
 * group called "Daddies Leeds" keeps its letter square rather than guessing.
 *
 * No React or asset imports here, so this file is easy to unit test.
 */
export const ROOM_ICON_KEYS = [
  'bears-cubs',
  'daddies',
  'discreet-dl',
  'group-play',
  'kink-pig',
  'leather-gear',
  'muscle-jocks',
  'smokers-cigars',
] as const;

export type RoomIconKey = (typeof ROOM_ICON_KEYS)[number];

const KEY_SET = new Set<string>(ROOM_ICON_KEYS);

/** Words that never change which room it is. */
const FILLER_WORDS = new Set(['and', 'n', 'the', 'room', 'rooms']);

/** "Bears & Cubs Room" -> "bears-cubs". Returns '' for empty input. */
export function roomIconSlug(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !FILLER_WORDS.has(w))
    .join('-');
}

/** The icon for a room, or null when it should keep its letter square. */
export function roomIconKey(room: { name?: string | null; official_slug?: string | null }): RoomIconKey | null {
  const fromSlug = roomIconSlug(room.official_slug);
  if (KEY_SET.has(fromSlug)) return fromSlug as RoomIconKey;
  const fromName = roomIconSlug(room.name);
  if (KEY_SET.has(fromName)) return fromName as RoomIconKey;
  return null;
}

/** Letter-square fallback: first letter of up to two words, A-Z and 0-9 only. */
export function roomInitials(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, '')[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
