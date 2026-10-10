/**
 * Hot-spot live check-in counts on the client.
 *
 * The server sends `live_count` already rounded for the viewer (Premium exact;
 * Free 0 to 4 exact, then '5+') and `live_count_exact` only to Premium (null for
 * Free). UI labels must use `live_count` and never derive a number from
 * `live_count_exact`, so Free never sees an exact count anywhere.
 */
export type HotSpotCountFields = {
  has_active_checkins?: boolean;
  /** Premium only. Null or missing for Free viewers. */
  live_count_exact?: number | null;
  /** Server display count, already rounded for Free. */
  live_count?: number | string | null;
};

/** Free cap the server uses: 0 to 4 exact, then this label. */
export const FREE_LIVE_COUNT_CAP = 5;
export const FREE_LIVE_COUNT_CAP_LABEL = `${FREE_LIVE_COUNT_CAP}+`;

function displayCountIsPositive(live: HotSpotCountFields['live_count']): boolean {
  if (typeof live === 'number') return live > 0;
  if (typeof live === 'string') return /^\d+\+$/.test(live) || Number(live) > 0;
  return false;
}

/** True when anyone is checked in. Works for Free (no exact) and Premium. */
export function isHotSpotActive(spot: HotSpotCountFields): boolean {
  if (spot.has_active_checkins === true) return true;
  if (spot.has_active_checkins === false) return false;
  if (typeof spot.live_count_exact === 'number') return spot.live_count_exact > 0;
  return displayCountIsPositive(spot.live_count);
}

/** The count to show on a pin, card or sheet. Server value only; '' when unknown. */
export function hotSpotCountLabel(spot: HotSpotCountFields): string {
  const live = spot.live_count;
  if (live == null) return '';
  if (typeof live === 'number') return String(live);
  return /^\d+\+?$/.test(live) ? live : '';
}

/**
 * The count to show while a spot is active, or '' when the server sent no
 * positive count. The pin, sheet and card all show this number when there is
 * one (so 1 reads as "1 checked in"); 'Active now' is only for no count.
 */
export function activeHotSpotCountLabel(spot: HotSpotCountFields): string {
  if (!isHotSpotActive(spot)) return '';
  const label = hotSpotCountLabel(spot);
  return label !== '' && label !== '0' ? label : '';
}

/**
 * Optimistic +1 / -1 after the viewer checks in or out (until the list refetch lands).
 * Keeps Free rounding: a Free viewer never gets an exact number above the cap.
 */
export function adjustHotSpotLiveCount<T extends HotSpotCountFields>(
  spot: T,
  delta: 1 | -1,
): Pick<T, 'live_count' | 'live_count_exact' | 'has_active_checkins'> {
  if (typeof spot.live_count_exact === 'number') {
    const next = Math.max(0, spot.live_count_exact + delta);
    return { live_count: next, live_count_exact: next, has_active_checkins: next > 0 } as Pick<
      T,
      'live_count' | 'live_count_exact' | 'has_active_checkins'
    >;
  }
  const live = spot.live_count;
  let nextLive: number | string;
  if (typeof live === 'number') {
    const next = Math.max(0, live + delta);
    nextLive = next >= FREE_LIVE_COUNT_CAP ? FREE_LIVE_COUNT_CAP_LABEL : next;
  } else if (live === FREE_LIVE_COUNT_CAP_LABEL) {
    // 5+ minus one could be 4 or still 5+; keep the cap until the server answers.
    nextLive = FREE_LIVE_COUNT_CAP_LABEL;
  } else {
    nextLive = delta > 0 ? 1 : 0;
  }
  return {
    live_count: nextLive,
    live_count_exact: null,
    has_active_checkins: displayCountIsPositive(nextLive),
  } as Pick<T, 'live_count' | 'live_count_exact' | 'has_active_checkins'>;
}
