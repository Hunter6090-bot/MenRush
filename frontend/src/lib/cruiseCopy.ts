/**
 * Hot Spots / Cruise quiet-face copy (Legal RED quiet-face).
 * Factual only — no marketing fluff, density claims, or Scene RED tips.
 * Outdoor ops-curated pins are LIVE under Al override (#258); do not say
 * commercial-only when the outdoor layer is on the public map.
 */
export const CRUISE_PIN_LABEL = 'Cruise';
export const HOT_SPOTS_CHIP_LABEL = 'Hot Spots';

/** Short map banner (quiet, less map-eating). */
export const HOT_SPOTS_MAP_BANNER =
  'Commercial venues and ops-curated outdoor spots. 18+. MenRush does not run these places. No illegal activity.';

/** Live face helper (sheet / page). */
export const HOT_SPOTS_HELPER =
  'Commercial venues and ops-curated outdoor spots. Saunas and gay venues. 18+ only.';

/** Live face rules (sheet / page). */
export const HOT_SPOTS_RULES =
  "Follow the venue's rules. MenRush does not run these places. No illegal activity.";

/** Full Brand face used on venue sheet. */
export const HOT_SPOTS_FACE = `${HOT_SPOTS_HELPER} ${HOT_SPOTS_RULES}`;

/** Kept Brand safety cue (already signed). */
export const HOT_SPOTS_CONSENT = 'Meet in public · Consent first';

export const HOT_SPOTS_PAGE_BLURB =
  `${HOT_SPOTS_FACE} Check in on the map. Pins stay visible. Dim when empty. Solid when someone is checked in.`;

/** Required face substrings for BOA90 / unit checks. */
export const HOT_SPOTS_FACE_REQUIRED_LINES = [
  'Commercial venues and ops-curated outdoor spots',
  '18+ only',
  "Follow the venue's rules",
  'MenRush does not run these places',
  'No illegal activity',
] as const;

/** Map banner must never claim commercial-only while outdoor is live. */
export const HOT_SPOTS_MAP_BANNER_REQUIRED = [
  'ops-curated outdoor',
  '18+',
  'MenRush does not run these places',
  'No illegal activity',
] as const;
