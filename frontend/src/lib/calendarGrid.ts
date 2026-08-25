/**
 * Convert JS Date#getDay() (Sun=0 … Sat=6) to leading blank cells
 * for a Monday-first calendar grid (Mon … Sun headers).
 */
export function mondayFirstLeadingBlanks(sundayIndexedWeekday: number): number {
  const day = ((sundayIndexedWeekday % 7) + 7) % 7;
  return (day + 6) % 7;
}

export const MONDAY_FIRST_WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
