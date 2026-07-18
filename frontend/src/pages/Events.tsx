import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EventDTO, eventsAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { useLocationStore } from '../hooks/store';
import { resolveLocaleTag } from '../lib/localeUnits';

const CATEGORIES = ['All', 'Nightclub', 'Drag', 'Live', 'Bar', 'Pride', 'Fetish'] as const;

function eventCategory(ev: EventDTO): string {
  const name = `${ev.name} ${ev.description ?? ''}`.toLowerCase();
  if (name.includes('drag')) return 'Drag';
  if (name.includes('pride')) return 'Pride';
  if (name.includes('leather') || name.includes('fetish')) return 'Fetish';
  if (name.includes('bar') || name.includes('quiz')) return 'Bar';
  if (name.includes('live') || name.includes('show')) return 'Live';
  return 'Nightclub';
}

export const Events = () => {
  const { lat, lng } = useLocationStore();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) {
      setLoading(false);
      return;
    }
    eventsAPI
      .getNearby(lat, lng, 50, 24)
      .then((res) => setEvents(res.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  const enriched = useMemo(
    () =>
      events.map((ev) => ({
        ...ev,
        cat: eventCategory(ev),
        day: ev.starts_at ? new Date(ev.starts_at).getDate() : null,
      })),
    [events],
  );

  const visible = enriched.filter((ev) => {
    if (category !== 'All' && ev.cat !== category) return false;
    if (selectedDay != null && ev.day !== selectedDay) return false;
    return true;
  });

  const now = new Date();
  const monthLabel = now.toLocaleString(resolveLocaleTag({ lat, lng }), {
    month: 'long',
    year: 'numeric',
  });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const eventDays = new Set(enriched.map((e) => e.day).filter(Boolean));

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-5 flex flex-wrap items-baseline gap-3">
          <h1 className="flex-1 text-2xl font-extrabold text-[var(--cream)]">Events across the UK</h1>
          <Link
            to="/contact"
            className="rounded-full border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] px-5 py-2.5 text-[13px] font-extrabold tracking-wide text-[#E0A14A] transition-colors hover:bg-[rgba(196,131,42,0.2)]"
          >
            PROMOTE YOUR EVENT
          </Link>
        </div>
        <p className="mb-5 text-sm text-[var(--cream-muted)]">
          Gay events and venues, by what you&apos;re into.{' '}
          <Link to="/hot-spots" className="font-semibold text-[#C4832A] hover:text-[#E0A14A]">
            Browse Hot Spots check-ins →
          </Link>
        </p>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={category === cat ? 'mr-pill mr-pill-active' : 'mr-pill mr-pill-inactive'}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {lat == null || lng == null ? (
              <div
                className="rounded-2xl border border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.08)] px-6 py-12 text-center shadow-[0_12px_28px_rgba(0,0,0,0.3)]"
                data-testid="events-location-gate"
                role="status"
              >
                <p className="text-[16px] font-extrabold text-[var(--cream)]">
                  We need your location for Events
                </p>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--cream-muted)]">
                  Not broadcasting an exact public pin — we need GPS privately to show what&apos;s near
                  you. Shared only while you use the app.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    to="/settings"
                    className="rounded-full bg-[#C4832A] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
                  >
                    Allow in Settings
                  </Link>
                  <Link
                    to="/hot-spots"
                    className="rounded-full border border-[rgba(196,131,42,0.5)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
                  >
                    Hot Spots
                  </Link>
                </div>
                <p className="mt-4 text-[11px] text-[var(--cream-muted)]">Meet in public · Consent first</p>
              </div>
            ) : loading ? (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-56 animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div
                className="rounded-2xl border border-[rgba(196,131,42,0.3)] bg-[rgba(196,131,42,0.05)] px-6 py-12 text-center"
                data-testid="events-empty"
              >
                <p className="text-[15px] font-extrabold text-[var(--cream)]">No events in this filter</p>
                <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--cream-muted)]">
                  Clear the day filter or category, or check Hot Spots for live venues.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('All');
                      setSelectedDay(null);
                    }}
                    className="rounded-full bg-[#C4832A] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03]"
                  >
                    Clear filters
                  </button>
                  <Link
                    to="/hot-spots"
                    className="rounded-full border border-[rgba(196,131,42,0.5)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A]"
                  >
                    Hot Spots
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {visible.map((ev) => (
                  <article
                    key={ev.id}
                    className="mr-card flex flex-col overflow-hidden transition-transform hover:-translate-y-0.5 hover:border-[var(--copper)]/40"
                  >
                    <div className="h-[120px] bg-[var(--bg-elevated)]" />
                    <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                      <p className="text-xs font-extrabold tracking-wide text-[#E0A14A]">{ev.cat}</p>
                      <h2 className="text-base font-bold text-[var(--cream)]">{ev.name}</h2>
                      <p className="text-[13px] text-[var(--cream-muted)]">
                        {ev.venue_name || 'Venue TBC'} · {ev.member_count} in
                      </p>
                      {ev.description ? (
                        <p className="text-[13px] leading-relaxed text-[var(--cream-muted)]">{ev.description}</p>
                      ) : null}
                      <div className="mt-auto flex gap-2 pt-2">
                        <button type="button" className="mr-cta-gradient flex-1 rounded-full py-2 text-[13px] font-bold">
                          Tickets
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/rooms/${ev.id}`)}
                          className="flex-1 rounded-full border border-[var(--border-default)] py-2 text-[13px] font-bold text-[var(--cream-muted)] hover:border-[var(--copper)]/40 hover:text-[#E0A14A]"
                        >
                          Who&apos;s going
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="mr-card sticky top-6 h-fit p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-extrabold text-[var(--cream)]">{monthLabel}</p>
              <p className="text-xs text-[var(--cream-muted)]">{enriched.length} events</p>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--cream-muted)]">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[...Array((firstWeekday + 6) % 7)].map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const hasEvent = eventDays.has(day);
                const active = selectedDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(active ? null : day)}
                    className={`flex aspect-square flex-col items-center justify-center rounded-[10px] border text-xs font-semibold ${
                      active
                        ? 'border-[var(--copper)] bg-[rgba(196,131,42,0.2)] text-[#E0A14A]'
                        : 'border-[var(--border-default)] text-[var(--cream-muted)] hover:border-[var(--copper)]/40'
                    }`}
                  >
                    {day}
                    {hasEvent ? <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--copper)]" /> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--cream-muted)]">
              Copper dot = events that day. Tap a date to filter.
            </p>
          </aside>
        </div>
      </div>
    </Layout>
  );
};
