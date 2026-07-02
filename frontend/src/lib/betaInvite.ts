const BETA_INVITE_KEY = 'menrush:beta-invite-code';

export function saveValidatedBetaInviteCode(code: string): void {
  sessionStorage.setItem(BETA_INVITE_KEY, code.trim().toUpperCase());
}

export function getValidatedBetaInviteCode(): string | null {
  const code = sessionStorage.getItem(BETA_INVITE_KEY);
  return code?.trim() || null;
}

export function clearValidatedBetaInviteCode(): void {
  sessionStorage.removeItem(BETA_INVITE_KEY);
}

export function hasValidatedBetaInviteCode(): boolean {
  return getValidatedBetaInviteCode() !== null;
}
