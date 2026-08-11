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
