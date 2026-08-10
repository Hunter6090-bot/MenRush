/**
 * MenRush 2.0 §25 Status — structured / lightweight discovery signal.
 * Completely separate from Pulse and Mood.
 */

export type UserStatus =
  | 'available_now'
  | 'hosting'
  | 'travelling'
  | 'drinks'
  | 'dating'
  | 'looking_now'
  | 'busy'
  | 'do_not_disturb';

export const USER_STATUS_VALUES: UserStatus[] = [
  'available_now',
  'hosting',
  'travelling',
  'drinks',
  'dating',
  'looking_now',
  'busy',
  'do_not_disturb',
];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  available_now: 'Available now',
  hosting: 'Hosting',
  travelling: 'Travelling',
  drinks: 'Drinks',
  dating: 'Dating',
  looking_now: 'Looking now',
  busy: 'Busy',
  do_not_disturb: 'Do not disturb',
};

/** Subtle map-dot accents — keep muted so markers stay legible. */
export const USER_STATUS_ACCENT: Record<UserStatus, string> = {
  available_now: '#5CB85C',
  hosting: '#C4832A',
  travelling: '#5B8DEF',
  drinks: '#E8B04B',
  dating: '#D46A8A',
  looking_now: '#E07040',
  busy: '#8A7A68',
  do_not_disturb: '#A05050',
};

export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === 'string' && (USER_STATUS_VALUES as string[]).includes(value);
}
