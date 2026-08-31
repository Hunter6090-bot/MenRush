/** Calendar age from ISO date (YYYY-MM-DD), using local civil date. */
export function ageFromDateOfBirth(dob: string | Date, asOf: Date = new Date()): number {
  const birth =
    typeof dob === 'string'
      ? parseIsoDateOnly(dob)
      : new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());

  if (Number.isNaN(birth.getTime())) {
    throw new Error('Invalid date of birth');
  }

  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDiff = asOf.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function parseIsoDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error('Date must be YYYY-MM-DD');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    throw new Error('Invalid calendar date');
  }
  return d;
}

export function formatIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Discovery age filter floor — everyone on the app is 18+. */
export const AGE_FILTER_MIN = 18;
export const AGE_FILTER_MAX = 99;

export function clampDiscoveryAge(value: number): number {
  return Math.min(AGE_FILTER_MAX, Math.max(AGE_FILTER_MIN, Math.trunc(value)));
}

/** Parse nearby query age bounds; invalid/empty → undefined; always clamped 18–99. */
export function parseDiscoveryAgeBound(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return undefined;
  return clampDiscoveryAge(n);
}

/** Normalize min/max so min ≤ max when both present. */
export function normalizeDiscoveryAgeRange(
  minAge?: number,
  maxAge?: number,
): { minAge?: number; maxAge?: number } {
  if (minAge != null && maxAge != null && minAge > maxAge) {
    return { minAge: maxAge, maxAge: minAge };
  }
  return { minAge, maxAge };
}
