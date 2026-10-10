import { useEffect, useState } from 'react';
import { travelAPI } from '../api/client';

/**
 * "Show me to people looking around". On by default. Says only what it does:
 * when off, members using Look around on your area don't see you there.
 * Nearby, the map and chat are not affected.
 */
export function ShowInLookAroundRow() {
  const [checked, setChecked] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => travelAPI.getSettings())
      .then((res) => {
        if (!cancelled && res?.data) setChecked(res.data.show_in_look_around !== false);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    const next = !checked;
    setChecked(next);
    setSaving(true);
    setError('');
    try {
      const res = await travelAPI.setShowInLookAround(next);
      setChecked(res.data.show_in_look_around);
    } catch {
      setChecked(!next);
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 rounded-[var(--nn-radius-lg)] border border-[var(--nn-border)] bg-[var(--nn-card)] p-4"
      data-testid="settings-show-in-look-around"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-[var(--nn-text)]" id="look-around-row-label">
          Show me to people looking around
        </p>
        <p className="mt-0.5 text-[15px] text-[var(--nn-muted)]">
          {checked
            ? 'Members using Travel to look around your area can see you.'
            : 'Members using Travel to look around your area won’t see you there. Nearby is not affected.'}
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-[15px] font-semibold text-[var(--nn-danger-text)]">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="look-around-row-label"
        data-testid="toggle-show-in-look-around"
        disabled={!loaded || saving}
        onClick={() => void toggle()}
        className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-60"
      >
        <span
          aria-hidden
          className={`relative block h-6 w-10 rounded-full transition-colors ${
            checked ? 'bg-[var(--nn-copper)]' : 'bg-[var(--nn-border)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--nn-on-copper)] shadow transition-transform ${
              checked ? 'left-4' : 'left-0.5'
            }`}
          />
        </span>
      </button>
    </div>
  );
}
