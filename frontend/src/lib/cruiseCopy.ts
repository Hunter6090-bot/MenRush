/**
 * Brand-signed Cruise / Hot Spots copy (commercial venues only).
 * Periods not em dashes. No dating-coded voice. No fake density claims.
 * No PSE / cottage / toilet / outdoor cruising tips.
 */
export const CRUISE_PIN_LABEL = 'Cruise';
export const HOT_SPOTS_CHIP_LABEL = 'Hot Spots';

/** Live face line 1–2. */
export const HOT_SPOTS_HELPER =
  'Commercial venues only. Saunas and gay venues. 18+ only.';

/** Live face line 3–5. */
export const HOT_SPOTS_RULES =
  "Follow the venue's rules. MenRush does not run these places. No illegal activity.";

/** Full Brand face used on map helper + venue sheet. */
export const HOT_SPOTS_FACE = `${HOT_SPOTS_HELPER} ${HOT_SPOTS_RULES}`;

/** Kept Brand safety cue (already signed). */
export const HOT_SPOTS_CONSENT = 'Meet in public · Consent first';

export const HOT_SPOTS_PAGE_BLURB =
  `${HOT_SPOTS_FACE} Check in on the map. Pins stay visible. Dim when empty. Solid when someone is checked in.`;

/** Required face substrings for BOA90 / unit checks. */
export const HOT_SPOTS_FACE_REQUIRED_LINES = [
  'Commercial venues only. Saunas and gay venues.',
  '18+ only',
  "Follow the venue's rules",
  'MenRush does not run these places',
  'No illegal activity',
] as const;
