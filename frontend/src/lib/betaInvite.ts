export const BETA_INVITE_REQUIRED =
  String(import.meta.env.VITE_BETA_INVITE_REQUIRED || '').toLowerCase() === 'true';

/**
 * Match backend `premiumService.isBetaPremiumFree()`.
 * Open beta: Premium (Ghost, groups, etc.) is included for everyone unless an
 * operator sets VITE_BETA_PREMIUM_FREE=false (and invite beta is also off).
 */
export function isBetaPremiumFree(): boolean {
  const raw = String(import.meta.env.VITE_BETA_PREMIUM_FREE ?? '').toLowerCase();
  if (raw === 'false') return BETA_INVITE_REQUIRED;
  return true;
}

export const BETA_INVITE_STORAGE_KEY = 'menrush.beta.invite_code';

export function readStoredInviteCode(): string | null {
  try {
    const value = sessionStorage.getItem(BETA_INVITE_STORAGE_KEY);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

export function storeInviteCode(code: string): void {
  sessionStorage.setItem(BETA_INVITE_STORAGE_KEY, code.trim());
}

export function clearStoredInviteCode(): void {
  sessionStorage.removeItem(BETA_INVITE_STORAGE_KEY);
}
