/**
 * Hot Spots / Cruise quiet-face copy (Legal RED quiet-face).
 * Factual only — no marketing fluff, density claims, or Scene RED tips.
 *
 * Outdoor ops-curated pins are LIVE under Al override (#258).
 * KILL: any "Commercial venues only" / commercial-only-only claim while outdoor
 * pins are on the public map — that is a false claim.
 * AVOID: outdoor/cruising soft-sell, "Meet in public" next to outdoor, OSA claims.
 * Brand soft-OK (2026-09-13): keep the Legal draft face exact; periods only.
 */
export const CRUISE_PIN_LABEL = 'Cruise';
export const HOT_SPOTS_CHIP_LABEL = 'Hot Spots';

/**
 * Legal draft disclaimer (not counsel) — Brand soft-OK exact quiet face for
 * mixed commercial + outdoor under Al override #258.
 */
export const HOT_SPOTS_LEGAL_FACE =
  'Map spots include independent venues and outdoor locations. 18+ only. Follow the law and any venue rules. MenRush does not run these places. No illegal activity. Consent first.';

/** Short map banner — same Legal face (quiet, less map-eating). */
export const HOT_SPOTS_MAP_BANNER = HOT_SPOTS_LEGAL_FACE;

/** Live face helper / sheet / page — same Legal face (no separate Meet-in-public line). */
export const HOT_SPOTS_HELPER = HOT_SPOTS_LEGAL_FACE;

/** @deprecated Rules are folded into HOT_SPOTS_LEGAL_FACE; kept empty for callers that concatenate. */
export const HOT_SPOTS_RULES = '';

/** Full Brand face used on venue sheet / map helper. */
export const HOT_SPOTS_FACE = HOT_SPOTS_LEGAL_FACE;

/**
 * Consent is already in HOT_SPOTS_LEGAL_FACE ("Consent first.").
 * Do not append "Meet in public" — Brand/Legal lock: reads badly next to outdoor.
 */
export const HOT_SPOTS_CONSENT = '';

export const HOT_SPOTS_PAGE_BLURB =
  `${HOT_SPOTS_LEGAL_FACE} Check in on the map. Pins stay visible. Dim when empty. Solid when someone is checked in.`;

/** Required face substrings for BOA90 / unit checks. */
export const HOT_SPOTS_FACE_REQUIRED_LINES = [
  'independent venues and outdoor locations',
  '18+ only',
  'Follow the law and any venue rules',
  'MenRush does not run these places',
  'No illegal activity',
  'Consent first',
] as const;

/** Map banner must never claim commercial-only while outdoor is live. */
export const HOT_SPOTS_MAP_BANNER_REQUIRED = [
  'independent venues and outdoor locations',
  '18+ only',
  'MenRush does not run these places',
  'No illegal activity',
  'Consent first',
] as const;

/** Banned live-face phrases under Legal RED + Brand soft-OK. */
export const HOT_SPOTS_FACE_BANNED = [
  'commercial venues only',
  'meet in public',
  'cruising',
  'cottage',
  'cottaging',
  'glory hole',
  'truck stop',
  'dating',
  'soulmate',
] as const;
