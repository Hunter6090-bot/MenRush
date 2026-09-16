/** Calendar age from ISO date (YYYY-MM-DD). */
export function ageFromDateOfBirth(dob: string, asOf: Date = new Date()): number | null {
  if (!dob) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
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

/** UK face month labels (value = calendar month 1–12). */
export const UK_DOB_MONTHS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

/** Youngest allowed birth year for 18+ signup (local civil date). */
export function maxAdultDobYear(asOf: Date = new Date()): number {
  return asOf.getFullYear() - 18;
}

const DOB_YEAR_MIN = 1900;

/** Years for DOB select: newest adult year first down to 1900. */
export function dobYearOptions(asOf: Date = new Date()): number[] {
  const max = maxAdultDobYear(asOf);
  const years: number[] = [];
  for (let y = max; y >= DOB_YEAR_MIN; y -= 1) years.push(y);
  return years;
}

/** Days in month; if year omitted, use 29 for Feb (leap-safe upper bound). */
export function daysInCalendarMonth(month: number, year?: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) {
    if (year == null || !Number.isFinite(year)) return 29;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Compose Day/Month/Year selects → ISO `YYYY-MM-DD`.
 * UK order semantics (day, month, year). Rejects invalid calendar dates.
 */
export function composeIsoDateOfBirth(
  day: number | string,
  month: number | string,
  year: number | string,
): string | null {
  const d = typeof day === 'string' ? Number(day) : day;
  const m = typeof month === 'string' ? Number(month) : month;
  const y = typeof year === 'string' ? Number(year) : year;
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  return toValidatedIso(d, m, y);
}

/**
 * Normalize DOB typing/paste to en-GB `dd/mm/yyyy`.
 * Kept for non-Register surfaces; Register uses Day/Month/Year selects.
 * - Digit-only input gets `/` auto-inserted.
 * - `/`, `-`, and `.` are accepted as separators and normalized to `/`.
 * - Full ISO `YYYY-MM-DD` autofill/paste is converted to UK display order.
 * Never treats UK entry as US mm/dd.
 */
export function formatUkDobInput(raw: string): string {
  const trimmed = raw.trim();
  // Browser / password-manager autofill often pastes ISO with hyphens.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }

  // Accept UK separators (- . /), collapse runs, drop other junk.
  const cleaned = trimmed
    .replace(/[-.]/g, '/')
    .replace(/[^\d/]/g, '')
    .replace(/\/+/g, '/');

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').slice(0, 3);
    const d = (parts[0] ?? '').slice(0, 2);
    const m = (parts[1] ?? '').slice(0, 2);
    const y = (parts[2] ?? '').slice(0, 4);
    if (parts.length === 1) return d;
    if (parts.length === 2) return `${d}/${m}`;
    return `${d}/${m}/${y}`;
  }

  const digits = cleaned.slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Parse UK `dd/mm/yyyy` (also `-` / `.` separators; 1–2 digit day/month) → ISO `YYYY-MM-DD`.
 * Rejects invalid calendar dates and out-of-range years. Never treats input as mm/dd.
 */
export function parseUkDateOfBirth(input: string): string | null {
  const trimmed = input.trim();
  const isoDirect = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDirect) {
    // Already ISO from autofill — validate as calendar date, keep as ISO.
    const year = Number(isoDirect[1]);
    const month = Number(isoDirect[2]);
    const day = Number(isoDirect[3]);
    return toValidatedIso(day, month, year);
  }

  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return toValidatedIso(day, month, year);
}

function toValidatedIso(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const thisYear = new Date().getFullYear();
  if (year < DOB_YEAR_MIN || year > thisYear) return null;
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
