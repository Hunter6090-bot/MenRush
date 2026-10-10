/** QC #390: Events page check-in buttons are 15px / 44px, and Ghost members are never promised a pin. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, 'Events.tsx'), 'utf8');

describe('Events page check-in', () => {
  it('uses the shared notice (Ghost wording, no hard-coded pin line)', () => {
    expect(src).toContain('eventCheckInNotice(res.data');
    expect(src).not.toMatch(/Pin stays on the map/);
  });

  it('Tickets, Who\u2019s going and Check in are 15px with 44px targets', () => {
    for (const id of ['data-testid="event-tickets"', 'data-testid="event-whos-going"', 'data-testid={`event-checkin-${ev.id}`}']) {
      const at = src.indexOf(id);
      expect(at, id).toBeGreaterThan(-1);
      const chunk = src.slice(at, at + 1400);
      const cls = chunk.match(/className=(?:"([^"]*)"|\{[\s\S]*?\n\s*\})/)![0];
      expect(cls, id).toContain('min-h-[44px]');
      expect(cls, id).toContain('text-[15px]');
      expect(cls, id).not.toMatch(/text-\[1[0-4]px\]/);
    }
  });
});
