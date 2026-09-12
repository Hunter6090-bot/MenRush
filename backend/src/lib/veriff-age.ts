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
    reason?: string | null;
    reasonCode?: number | string | null;
  } | null;
};

/**
 * Extract a calendar DOB (YYYY-MM-DD) from a Veriff decision payload.
 * Prefers person.dateOfBirth from the document. Does not invent DOB from age estimates.
 * Returns null when DOB is missing or unparseable.
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

/** Read Veriff Age Estimation `estimatedAge` when present. Never invents a value. */
export function extractVeriffEstimatedAge(payload: VeriffDecisionAgePayload): number | null {
  const data = payload?.verification?.additionalVerifiedData;
  if (!data || Array.isArray(data)) return null;
  const raw = data.estimatedAge;
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 120) return null;
  return Math.floor(n);
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

/**
 * Document-DOB adult check (optional ID / legacy identity path).
 * Missing DOB → missing_dob (callers decide fail-closed vs ignore).
 */
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

/**
 * Signup liveness / age-estimation gate (required).
 * Underage when estimatedAge < 18 or document DOB proves under 18.
 * Approved with no underage signal → pass (Veriff portal threshold / liveness).
 * Does not require or store document DOB.
 */
export function isAdultFromLivenessDecision(
  payload: VeriffDecisionAgePayload,
  asOf: Date = new Date(),
):
  | { ok: true; age?: number; source: 'estimated_age' | 'document_dob' | 'approved' }
  | { ok: false; reason: 'underage' | 'no_decision'; age?: number } {
  const estimated = extractVeriffEstimatedAge(payload);
  if (estimated != null && estimated < ADULT_AGE_MINIMUM) {
    return { ok: false, reason: 'underage', age: estimated };
  }

  const doc = isAdultFromVeriffDecision(payload, asOf);
  if (!doc.ok && doc.reason === 'underage') {
    return { ok: false, reason: 'underage', age: doc.age };
  }

  if (estimated != null && estimated >= ADULT_AGE_MINIMUM) {
    return { ok: true, age: estimated, source: 'estimated_age' };
  }
  if (doc.ok) {
    return { ok: true, age: doc.age, source: 'document_dob' };
  }
  // Approved path with no underage signal — Veriff Age Estimation portal threshold.
  return { ok: true, source: 'approved' };
}

/** Build a YYYY-MM-DD that is exactly `years` old today (for fixtures). */
export function fixtureDateOfBirthYearsAgo(years: number, asOf: Date = new Date()): string {
  const d = new Date(asOf.getFullYear() - years, asOf.getMonth(), asOf.getDate());
  return formatIsoDateOnly(d);
}
