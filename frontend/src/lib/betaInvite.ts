export const BETA_INVITE_REQUIRED =
  String(import.meta.env.VITE_BETA_INVITE_REQUIRED || '').toLowerCase() === 'true';

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
