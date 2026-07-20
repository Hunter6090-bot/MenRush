/** localStorage key for 2FA "Trust this device" tokens (hashed at rest on server). */
const STORAGE_KEY = 'mr_device_trust';

type StoredTrust = {
  email: string;
  token: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getDeviceTrustToken(email: string): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredTrust;
    if (!parsed?.token || !parsed?.email) return undefined;
    if (normalizeEmail(parsed.email) !== normalizeEmail(email)) return undefined;
    if (typeof parsed.token !== 'string' || parsed.token.length < 32) return undefined;
    return parsed.token;
  } catch {
    return undefined;
  }
}

/** Returns the raw token for the current browser regardless of email (for Settings). */
export function getStoredDeviceTrustToken(): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredTrust;
    if (typeof parsed?.token !== 'string' || parsed.token.length < 32) return undefined;
    return parsed.token;
  } catch {
    return undefined;
  }
}

export function saveDeviceTrustToken(email: string, token: string): void {
  try {
    const payload: StoredTrust = { email: normalizeEmail(email), token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode failures — trust is optional.
  }
}

export function clearDeviceTrustToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
