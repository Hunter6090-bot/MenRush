import { eventMetaLine } from '../lib/eventWhen';
import React, { useEffect, useState } from 'react';
import { EventDTO, eventsAPI } from '../api/client';

interface EventsRailProps {
  lat?: number | null;
  lng?: number | null;
  onSelect: (event: EventDTO) => void;
}

export const EventsRail: React.FC<EventsRailProps> = ({ lat, lng, onSelect }) => {
  const [events, setEvents] = useState<EventDTO[]>([]);

  useEffect(() => {
    if (lat == null || lng == null) return;
    eventsAPI
      .getNearby(lat, lng, 8, 8)
      .then((res) => setEvents(res.data))
      .catch(() => setEvents([]));
  }, [lat, lng]);

  if (events.length === 0) return null;

  return (
    <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-4 [-webkit-overflow-scrolling:touch]">
      <div className="flex w-max max-w-none gap-3 pb-1">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event)}
            className="min-w-[220px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/90 p-4 text-left backdrop-blur-sm transition-colors hover:border-[var(--copper)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold text-[var(--cream)]">{event.name}</p>
                {eventMetaLine(event) ? (
                  <p className="mt-1 text-[15px] text-[var(--cream-muted)]" data-testid={`events-rail-meta-${event.id}`}>
                    {eventMetaLine(event)}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full bg-[var(--copper)]/15 px-2 py-1 text-[15px] font-bold text-[var(--nn-accent-text)]">
                {event.member_count} in
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
