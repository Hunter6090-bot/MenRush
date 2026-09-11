import { ageFromDateOfBirth, formatIsoDateOnly } from './age';

/** UK / MenRush adult lock — 18+ only. */
export const ADULT_AGE_MINIMUM = 18;

export type VeriffPersonAgeSource = {
  dateOfBirth?: string | null;
  yearOfBirth?: string | number | null;
};

export type VeriffDecisionAgePayload = {
  verification?: {
    person?: VeriffPersonAgeSource | null;
    additionalVerifiedData?:
      | { estimatedAge?: number | string | null }
      | Array<unknown>
      | null;
  } | null;
};

/**
 * Extract a calendar DOB (YYYY-MM-DD) from a Veriff decision payload.
 * Prefers person.dateOfBirth from the document. Does not invent DOB from age estimates.
 * Returns null when DOB is missing or unparseable — callers must fail closed for signup.
 */
export function extractVeriffDateOfBirth(payload: VeriffDecisionAgePayload): string | null {
  const raw = payload?.verification?.person?.dateOfBirth;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  // Accept YYYY-MM-DD; Veriff docs use this form.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  try {
    // Validate calendar date via age helper.
    ageFromDateOfBirth(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

export function ageFromVeriffDecision(
  payload: VeriffDecisionAgePayload,
  asOf: Date = new Date(),
): { age: number; dateOfBirth: string } | null {
  const dob = extractVeriffDateOfBirth(payload);
  if (!dob) return null;
  try {
    return { age: ageFromDateOfBirth(dob, asOf), dateOfBirth: dob };
  } catch {
    return null;
  }
}

export function isAdultFromVeriffDecision(
  payload: VeriffDecisionAgePayload,
  asOf: Date = new Date(),
): { ok: true; age: number; dateOfBirth: string } | { ok: false; reason: 'missing_dob' | 'underage'; age?: number } {
  const parsed = ageFromVeriffDecision(payload, asOf);
  if (!parsed) return { ok: false, reason: 'missing_dob' };
  if (parsed.age < ADULT_AGE_MINIMUM) {
    return { ok: false, reason: 'underage', age: parsed.age };
  }
  return { ok: true, age: parsed.age, dateOfBirth: parsed.dateOfBirth };
}

/** Build a YYYY-MM-DD that is exactly `years` old today (for fixtures). */
export function fixtureDateOfBirthYearsAgo(years: number, asOf: Date = new Date()): string {
  const d = new Date(asOf.getFullYear() - years, asOf.getMonth(), asOf.getDate());
  return formatIsoDateOnly(d);
}
