/**
 * Event time copy (Brand, 10 Oct 2026): show only the dates we actually have.
 * No countdown, no "Tonight", no "Saved" tick, nothing that promises a night the
 * data can't back up. Missing or invalid times are simply left out.
 */
import { resolveLocaleTag } from './localeUnits';

type EventTimes = { starts_at?: string | null; ends_at?: string | null };

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(d: Date): string {
  return d.toLocaleString(resolveLocaleTag(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

/** "Fri 16 Oct, 22:00 to Sat 17 Oct, 03:00", "From …", "Until …", or null. */
export function eventWhenLabel(ev: EventTimes): string | null {
  const start = parse(ev.starts_at);
  const end = parse(ev.ends_at);
  if (start && end) return `${fmt(start)} to ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}

/** Venue name plus whatever dates exist, joined with a middle dot. */
export function eventMetaLine(ev: EventTimes & { venue_name?: string | null }): string {
  return [ev.venue_name?.trim() || null, eventWhenLabel(ev)].filter(Boolean).join(' · ');
}
