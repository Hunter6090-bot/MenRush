/**
 * Tracking params we carry between public pages: `ref` (referral code, read by
 * /register as `referral_code` at signup) and any `utm_*`. Keys are matched
 * case-insensitively and normalised to lowercase, so `REF` becomes `ref` and
 * `UTM_Source` becomes `utm_source`. Values are trimmed; empty values are
 * dropped; the first non-empty value for a key wins. Everything else is dropped.
 */
export const REFERRAL_PARAM = 'ref';

export function isTrackingParamKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower === REFERRAL_PARAM || /^utm_[a-z0-9_]+$/.test(lower);
}

export function pickTrackingParams(search: string | URLSearchParams): URLSearchParams {
  const source = typeof search === 'string' ? new URLSearchParams(search) : search;
  const picked = new URLSearchParams();
  source.forEach((value, key) => {
    if (!isTrackingParamKey(key)) return;
    const lower = key.toLowerCase();
    const trimmed = value.trim();
    if (trimmed && !picked.has(lower)) picked.set(lower, trimmed);
  });
  return picked;
}

/** Read a query param ignoring key case (`?REF=x` and `?ref=x` both return `x`). */
export function getParamIgnoreCase(params: URLSearchParams, key: string): string | null {
  const wanted = key.toLowerCase();
  let found: string | null = null;
  params.forEach((value, k) => {
    if (found === null && k.toLowerCase() === wanted && value.trim()) found = value;
  });
  return found;
}

/**
 * Append the tracking params from `search` to `path` (which may already carry
 * its own query, e.g. `/register?invite=CODE`). Params already on `path` win.
 */
export function withTrackingParams(path: string, search: string | URLSearchParams): string {
  const tracking = pickTrackingParams(search);
  const [base, existing = ''] = path.split('?');
  const next = new URLSearchParams(existing);
  tracking.forEach((value, key) => {
    if (!next.has(key)) next.set(key, value);
  });
  const query = next.toString();
  return query ? `${base}?${query}` : base;
}
