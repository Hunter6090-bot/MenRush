import { useCallback, useEffect, useState } from 'react';
import { locationPrivacyAPI, type LocationHiddenPerson } from '../api/client';
import { BrandAvatar } from './BrandAvatar';

/**
 * "Hide my location from" manage list (You > Settings > Location).
 * Owner-only. People on it don't see you in Nearby or on the map, and see no
 * distance on your profile. Chat still works. Add from the ··· menu on a profile.
 */
export function HideLocationList() {
  const [people, setPeople] = useState<LocationHiddenPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await locationPrivacyAPI.listHidden();
      setPeople(res.data?.hidden ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (person: LocationHiddenPerson) => {
    setRemovingId(person.id);
    setNotice(null);
    try {
      await locationPrivacyAPI.unhide(person.id);
      setPeople((prev) => prev.filter((p) => p.id !== person.id));
      setNotice(`${person.name} can see where you are again.`);
    } catch {
      setNotice('Could not remove. Try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section
      id="hide-location"
      className="mr-card scroll-mt-24 p-4 sm:p-5"
      data-testid="settings-hide-location"
      aria-labelledby="hide-location-title"
    >
      <h3 id="hide-location-title" className="text-[18px] font-bold text-[var(--cream)]">
        Hide my location from
      </h3>
      <p className="mt-1 text-[15px] leading-snug text-[var(--cream-muted)]">
        They won&apos;t see you nearby or on the map. Chat still works.
      </p>

      {notice ? (
        <p className="mt-3 text-[15px] font-medium text-[#8FC773]" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-[15px] text-[var(--cream-muted)]">Loading…</p>
      ) : failed ? (
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 min-h-[44px] text-[15px] font-bold text-[var(--copper)]"
        >
          Could not load. Tap to retry.
        </button>
      ) : people.length === 0 ? (
        <p className="mt-4 text-[15px] text-[var(--cream-muted)]" data-testid="hide-location-empty">
          No one yet. Use ··· on a profile.
        </p>
      ) : (
        <ul className="mt-4 space-y-2" data-testid="hide-location-list">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5"
              data-testid={`hide-location-row-${person.id}`}
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
                <BrandAvatar photoUrl={person.photo_url} name={person.name} size={48} />
              </span>
              <p className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[var(--cream)]">
                {person.name}
              </p>
              <button
                type="button"
                disabled={removingId === person.id}
                onClick={() => void remove(person)}
                aria-label={`Remove ${person.name}`}
                className="min-h-[44px] shrink-0 rounded-full border border-[var(--border-default)] px-4 text-[15px] font-bold text-[var(--copper)] hover:border-[var(--copper)] disabled:opacity-50"
              >
                {removingId === person.id ? '…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
