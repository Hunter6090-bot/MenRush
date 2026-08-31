import type { EventDTO } from '../api/client';

/**
 * Events currently have no ticket/URL column. If a future field lands
 * (ticket_url / external_url / url), open it. Otherwise return null so the
 * UI can hide the fake Tickets button.
 */
export function eventTicketUrl(ev: EventDTO): string | null {
  const record = ev as EventDTO & Record<string, unknown>;
  const candidates = [record.ticket_url, record.external_url, record.url];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch {
      /* ignore invalid */
    }
  }
  return null;
}
