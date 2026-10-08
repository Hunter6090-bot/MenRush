/** Jerk copy in one place so Brand can swap it. Larger type, fewer words. */
export const JERK_LABEL = 'Jerk';
export const JERK_SENT_TOAST = 'Sent 😏';
export const JERK_LIMIT_FALLBACK = 'Daily limit reached. Back tomorrow.';
export const JERK_UNAVAILABLE = 'Not available.';
export const JERK_FAILED = 'Could not send. Try again.';
/** How long the toast stays up. */
export const JERK_TOAST_MS = 1800;

export type JerkSurface = 'grid' | 'profile' | 'pin_sheet' | 'chat';

export type JerkApiResult = {
  status: 'sent' | 'repeat';
  jerk_id: string;
  sent_today: number;
  daily_limit: number;
};

/** Map an API error to short toast copy (429 is the friendly daily cap). */
export function jerkErrorMessage(err: unknown): string {
  const res = (err as { response?: { status?: number; data?: { error?: string; code?: string } } })
    ?.response;
  if (res?.status === 429 || res?.data?.code === 'jerk_daily_limit') {
    return res?.data?.error || JERK_LIMIT_FALLBACK;
  }
  if (res?.status === 404 || res?.status === 403) return JERK_UNAVAILABLE;
  return JERK_FAILED;
}
