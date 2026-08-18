/** Format a local civil date as YYYY-MM-DD (never use toISOString — UTC shifts the day). */
export function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalize API / Date / ISO values into an `<input type="date">` value.
 * Never use `String(date).slice(0, 10)` — that yields "Fri May 15", which
 * clears the controlled date input and makes DOB appear to "revert" on reload.
 */
export function toDateInputValue(raw: unknown): string {
  if (raw == null || raw === '') return '';

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (ymd) {
      // Prefer the calendar prefix for DATE / timestamptz text from Postgres.
      // For pure YYYY-MM-DD keep it; for ISO datetimes use the UTC date part
      // only when a time component is present (node-pg Date → JSON).
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      if (trimmed.includes('T') || trimmed.includes(' ')) {
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
          // DATE columns serialize as UTC midnight; use UTC Y-M-D to avoid
          // westward timezone off-by-one.
          const y = parsed.getUTCFullYear();
          const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
          const day = String(parsed.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
      }
      return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    }
    return '';
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const day = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return '';
}

/** Max YYYY-MM-DD for an 18+ date-of-birth picker (local civil date). */
export function maxAdultDateOfBirth(asOf: Date = new Date()): string {
  const d = new Date(asOf.getFullYear() - 18, asOf.getMonth(), asOf.getDate());
  return formatLocalIsoDate(d);
}

/** Calendar age from ISO date (YYYY-MM-DD). */
export function ageFromDateOfBirth(dob: string, asOf: Date = new Date()): number | null {
  if (!dob) return null;
  const normalized = toDateInputValue(dob);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return null;
  }

  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDiff = asOf.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function formatHeight(cm: number | null | undefined): string | null {
  if (cm == null || !Number.isFinite(cm)) return null;
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}" · ${cm} cm`;
}

export function formatWeight(kg: number | null | undefined): string | null {
  if (kg == null || !Number.isFinite(kg)) return null;
  const lbs = Math.round(kg * 2.20462);
  return `${kg} kg · ${lbs} lb`;
}
