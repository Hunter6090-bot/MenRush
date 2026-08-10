import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { PremiumGate } from './PremiumGate';

interface ProfilePrivateNoteProps {
  targetUserId: string;
  targetName: string;
}

/** Premium-only private note — only you can see this on their profile. */
export function ProfilePrivateNote({ targetUserId, targetName }: ProfilePrivateNoteProps) {
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showGate, setShowGate] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    usersAPI
      .getProfileNote(targetUserId)
      .then((res) => {
        if (cancelled) return;
        const value = res.data.note ?? '';
        setNote(value);
        setDraft(value);
        setExpanded(Boolean(value));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
        if (code === 'premium_required') {
          setShowGate(true);
        } else {
          setError('Could not load your note.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const save = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const res = await usersAPI.saveProfileNote(targetUserId, draft);
      setNote(res.data.note ?? draft.trim());
      setDraft(res.data.note ?? draft.trim());
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'premium_required') {
        setShowGate(true);
      } else {
        setError('Could not save note.');
      }
    } finally {
      setSaving(false);
    }
  }, [draft, targetUserId]);

  if (showGate) {
    return (
      <PremiumGate
        headline="Private profile notes"
        subline={`Remember details about ${targetName} — only you see this.`}
        perks={['Save private notes on any profile', 'Synced across your devices', 'Never visible to them']}
        ctaLabel="Unlock — £6.99/mo"
        onClose={() => setShowGate(false)}
        onUnlock={() => navigate('/premium')}
      />
    );
  }

  if (loading) {
    return (
      <p className="text-[11px] text-[var(--cream-muted)]" data-testid="profile-note-loading">
        Loading your note…
      </p>
    );
  }

  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-elevated)' }}
      data-testid="profile-private-note"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-bold text-[var(--cream)]">
          Your private note
          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--copper)]">
            Premium
          </span>
        </span>
        <span className="text-[10px] text-[var(--cream-muted)]">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded ? (
        <>
          <p className="mt-1 text-[10px] text-[var(--cream-muted)]">
            Only you see this — reminders about {targetName}.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Met at the bar, prefers afternoon meets…"
            className="mt-2 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--copper)]"
            style={{
              borderColor: 'var(--border-default)',
              background: 'var(--bg-card)',
              color: 'var(--cream)',
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--cream-muted)]">
              {draft.length}/2000
              {note && draft === note ? ' · saved' : ''}
            </span>
            <button
              type="button"
              disabled={saving || draft === note}
              onClick={() => void save()}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-50"
              style={{ background: 'var(--copper)', color: 'var(--nn-on-copper)' }}
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
          {error ? <p className="mt-1 text-[10px] text-[var(--nn-danger-light,#D96A52)]">{error}</p> : null}
        </>
      ) : note ? (
        <p className="mt-2 line-clamp-2 text-[11px] text-[var(--cream-muted)]">{note}</p>
      ) : null}
    </div>
  );
}
