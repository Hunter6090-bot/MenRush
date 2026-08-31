/**
 * Product lock 31 Aug 2026 (Brand / Zoul): open signup.
 * Sign up free must land on /register with no invite code required.
 * A stale Vercel `VITE_BETA_INVITE_REQUIRED=true` must not gate registration.
 * Optional MENRUSH invites still work via /beta or ?invite= query.
 */
export const BETA_INVITE_REQUIRED = false;

/**
 * Match backend `premiumService.isBetaPremiumFree()`.
 * Open beta: Premium (Ghost, groups, etc.) is included for everyone unless an
 * operator sets VITE_BETA_PREMIUM_FREE=false.
 */
export function isBetaPremiumFree(): boolean {
  const raw = String(import.meta.env.VITE_BETA_PREMIUM_FREE ?? '').toLowerCase();
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  // Default: treat as free during open UK beta until billing is live.
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
