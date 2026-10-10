/**
 * First-launch 18+ gate (src/lib/ageGate.ts). Existing specs start as a device
 * that already tapped "I'm 18 or over", so they test the page, not the gate.
 * Keep the key and value in step with src/lib/ageGate.ts.
 */
import { PLAYWRIGHT_BASE_URL } from './base-url';

export const AGE_GATE_STORAGE_KEY = 'menrush_age_gate_v1';
export const AGE_GATE_ADULT_VALUE = 'adult';

/** Playwright storageState with the remembered answer for the app origin. */
export const ADULT_CONFIRMED_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: new URL(PLAYWRIGHT_BASE_URL).origin,
      localStorage: [{ name: AGE_GATE_STORAGE_KEY, value: AGE_GATE_ADULT_VALUE }],
    },
  ],
};

/** A brand-new device: nothing remembered. */
export const FRESH_DEVICE_STORAGE_STATE = { cookies: [], origins: [] };
