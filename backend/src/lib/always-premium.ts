/** Owner accounts that must never lose Premium entitlement. */
export const ALWAYS_PREMIUM_NAMES = ['BOA90', 'Bigbear25', 'HantsBear'] as const;

export function isAlwaysPremiumName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return ALWAYS_PREMIUM_NAMES.some((x) => x.toLowerCase() === n);
}
