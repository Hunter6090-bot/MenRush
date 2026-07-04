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
    <div className="overflow-x-auto px-4">
      <div className="flex gap-3 pb-1">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event)}
            className="min-w-[220px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/90 p-4 text-left backdrop-blur-sm transition-colors hover:border-[var(--copper)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--copper)]">
                  After Hours
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--cream)]">{event.name}</p>
                <p className="mt-1 text-xs text-[var(--cream-muted)]">
                  {event.venue_name || 'Location shared after join'}
                </p>
              </div>
              <span className="rounded-full bg-[var(--copper)]/15 px-2 py-1 text-[10px] font-bold text-[var(--copper)]">
                {event.member_count} in
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
