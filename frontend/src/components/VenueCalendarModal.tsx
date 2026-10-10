import React, { useState, useEffect } from 'react';
import { hotSpotsAPI, HotSpotDTO, VenueCalendarEventDTO } from '../api/client';

interface VenueCalendarModalProps {
  spot: HotSpotDTO | null;
  open: boolean;
  onClose: () => void;
}

export const VenueCalendarModal: React.FC<VenueCalendarModalProps> = ({
  spot,
  open,
  onClose,
}) => {
  const [events, setEvents] = useState<VenueCalendarEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [cancellingEventId, setCancellingEventId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');

  // Form states
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    if (!spot) return;
    setLoading(true);
    setError('');
    try {
      const res = await hotSpotsAPI.listVenueEvents(spot.id);
      setEvents(res.data.events || []);
      setCanManage(Boolean(res.data.can_manage));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load venue events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && spot) {
      void loadEvents();
      setShowAddForm(false);
      setCancellingEventId(null);
    }
  }, [open, spot?.id]);

  if (!open || !spot) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !startsAt) {
      setError('Event name and start date/time are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await hotSpotsAPI.createVenueEvent(spot.id, {
        name: eventName.trim(),
        description: eventDesc.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        ticket_url: ticketUrl.trim() || null,
      });

      setEventName('');
      setEventDesc('');
      setStartsAt('');
      setEndsAt('');
      setTicketUrl('');
      setShowAddForm(false);
      await loadEvents();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    try {
      await hotSpotsAPI.cancelVenueEvent(spot.id, eventId, {
        cancellation_reason: cancelReason.trim() || null,
      });
      setCancellingEventId(null);
      setCancelReason('');
      await loadEvents();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to cancel event.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-calendar-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--copper)]/40 bg-[var(--bg-card)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-xl font-bold text-[var(--cream-muted)] hover:text-[var(--cream)]"
          aria-label="Close"
        >
          ×
        </button>

        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(196,131,42,0.15)] px-2.5 py-0.5 text-[11px] font-extrabold text-[#E0A14A]">
              Venue claimed
            </span>
            <span className="rounded-full border border-[var(--border-default)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--cream-muted)]">
              Calendar managed by venue
            </span>
          </div>
          <h2 id="venue-calendar-title" className="mt-2 text-xl font-extrabold text-[var(--cream)]">
            {spot.name} Calendar
          </h2>
          <p className="text-xs text-[var(--cream-muted)]">
            {spot.city ? `${spot.city} · ` : ''}Venue submissions are UGC. Follow venue rules and UK law.
          </p>
        </div>

        {error ? (
          <div role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {canManage && !showAddForm ? (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mr-cta-gradient rounded-full px-4 py-2 text-xs font-bold"
            >
              + Add Schedule Event
            </button>
          </div>
        ) : null}

        {showAddForm ? (
          <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-xl border border-[var(--copper)]/30 bg-[var(--bg-elevated)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#E0A14A]">
                New Venue Schedule Event
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs text-[var(--cream-muted)] hover:text-[var(--cream)]"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">Event Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sunday Bear Session"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">Description (Optional)</label>
              <textarea
                rows={2}
                placeholder="Details, dress code, theme..."
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">Starts At *</label>
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">Ends At (Optional)</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--cream-muted)]">Ticket URL (Optional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--cream)] focus:border-[var(--copper)] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-full border border-[var(--border-default)] px-4 py-2 text-xs font-bold text-[var(--cream-muted)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="mr-cta-gradient rounded-full px-5 py-2 text-xs font-bold"
              >
                {saving ? 'Publishing…' : 'Publish to Calendar'}
              </button>
            </div>
          </form>
        ) : null}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <p className="py-8 text-center text-xs text-[var(--cream-muted)]">Loading events…</p>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 text-center">
              <p className="text-sm font-bold text-[var(--cream)]">No events scheduled yet</p>
              <p className="mt-1 text-xs text-[var(--cream-muted)]">
                The venue has not posted upcoming calendar events yet.
              </p>
            </div>
          ) : (
            events.map((ev) => {
              const isCancelled = ev.status === 'cancelled';
              const startDate = ev.starts_at ? new Date(ev.starts_at) : null;
              const formattedDate = startDate
                ? startDate.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Date TBD';

              return (
                <div
                  key={ev.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    isCancelled
                      ? 'border-red-900/30 bg-red-950/10 opacity-70'
                      : 'border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--copper)]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--cream)]">{ev.name}</h4>
                        {isCancelled ? (
                          <span className="rounded bg-red-900/50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">
                            Cancelled
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs font-semibold text-[#E0A14A]">{formattedDate}</p>
                      {ev.description ? (
                        <p className="mt-1 text-xs text-[var(--cream-muted)] leading-relaxed">
                          {ev.description}
                        </p>
                      ) : null}
                      {isCancelled && ev.cancellation_reason ? (
                        <p className="mt-1 text-[11px] text-red-400">
                          Reason: {ev.cancellation_reason}
                        </p>
                      ) : null}
                    </div>

                    {canManage && !isCancelled ? (
                      <div>
                        {cancellingEventId === ev.id ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              placeholder="Reason (optional)"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-[11px] text-[var(--cream)]"
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => void handleCancelEvent(ev.id)}
                                className="rounded bg-red-800 px-2 py-1 text-[11px] font-bold text-white"
                              >
                                Confirm Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancellingEventId(null)}
                                className="rounded border px-2 py-1 text-[11px] text-[var(--cream-muted)]"
                              >
                                Back
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingEventId(ev.id);
                              setCancelReason('');
                            }}
                            className="rounded-full border border-red-800/60 px-3 py-1 text-[11px] font-bold text-red-400 hover:bg-red-950/40"
                          >
                            Cancel event
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 border-t border-[var(--border-default)] pt-3 text-center">
          <p className="text-[11px] text-[var(--cream-muted)]">
            Face copy lock: &ldquo;Venue claimed&rdquo; · &ldquo;Calendar managed by venue&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
};
