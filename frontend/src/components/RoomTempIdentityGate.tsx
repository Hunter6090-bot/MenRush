import React, { useState } from 'react';

interface RoomTempIdentityGateProps {
  roomName: string;
  roomDescription?: string;
  isOfficial?: boolean;
  isLocationBased?: boolean;
  onReady: (identity: { displayName: string; photoUrl?: string }) => void;
  onCancel?: () => void;
}

/**
 * Gate shown before entering an official or location-based room.
 * User picks a temporary display name and optional photo URL.
 */
export const RoomTempIdentityGate: React.FC<RoomTempIdentityGateProps> = ({
  roomName,
  roomDescription,
  isOfficial,
  isLocationBased,
  onReady,
  onCancel,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [agreedRules, setAgreedRules] = useState(false);
  const [agreedAnon, setAgreedAnon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnter = () => {
    if (!displayName.trim()) {
      setError('Please choose a display name for this room.');
      return;
    }
    if (displayName.trim().length < 2 || displayName.trim().length > 32) {
      setError('Display name must be 2–32 characters.');
      return;
    }
    if (!agreedRules || !agreedAnon) {
      setError('Please accept both checkboxes to continue.');
      return;
    }
    setError(null);
    onReady({ displayName: displayName.trim(), photoUrl: photoUrl.trim() || undefined });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-10">
      <div
        className="w-full max-w-sm rounded-2xl border p-6 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'rgba(196,131,42,0.35)',
        }}
      >
        {/* Room badge */}
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
            style={{
              background: 'linear-gradient(135deg,rgba(196,131,42,0.3),rgba(139,69,19,0.2))',
              border: '1px solid rgba(196,131,42,0.35)',
              color: '#C4832A',
            }}
          >
            {roomName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-[var(--cream)]">{roomName}</p>
            {isOfficial && (
              <span className="inline-block rounded-full bg-[rgba(196,131,42,0.15)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#C4832A]">
                Official
              </span>
            )}
            {isLocationBased && !isOfficial && (
              <span className="inline-block rounded-full bg-[rgba(196,131,42,0.1)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#A89070]">
                Location-based
              </span>
            )}
          </div>
        </div>

        {roomDescription ? (
          <p className="mb-4 text-[12px] leading-relaxed text-[var(--cream-muted)]">
            {roomDescription}
          </p>
        ) : null}

        {/* Rules */}
        <div
          className="mb-4 rounded-xl p-3 text-[11px] leading-relaxed text-[#A89070]"
          style={{ background: 'rgba(196,131,42,0.06)', border: '1px solid rgba(196,131,42,0.15)' }}
        >
          <p className="mb-1 font-bold uppercase tracking-wider text-[#C4832A]">Room rules</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Be respectful — harassment will get you removed.</li>
            <li>No sharing personal info (numbers, addresses).</li>
            <li>Keep content legal and consenting adults only.</li>
            <li>Your temp identity hides your profile but your account remains accountable.</li>
          </ul>
        </div>

        {/* Temp name */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--cream-muted)]">
            Your display name in this room *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Anonymous Bear"
            maxLength={32}
            className="w-full rounded-xl px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[#4A3520] outline-none focus:ring-1 focus:ring-[rgba(196,131,42,0.5)]"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              caretColor: '#C4832A',
            }}
          />
        </div>

        {/* Optional photo */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--cream-muted)]">
            Photo URL (optional)
          </label>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[#4A3520] outline-none focus:ring-1 focus:ring-[rgba(196,131,42,0.5)]"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              caretColor: '#C4832A',
            }}
          />
        </div>

        {/* Checkboxes */}
        <label className="mb-2 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={agreedRules}
            onChange={(e) => setAgreedRules(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#C4832A]"
          />
          <span className="text-[11px] leading-relaxed text-[var(--cream-muted)]">
            I have read and agree to the room rules above.
          </span>
        </label>

        <label className="mb-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={agreedAnon}
            onChange={(e) => setAgreedAnon(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#C4832A]"
          />
          <span className="text-[11px] leading-relaxed text-[var(--cream-muted)]">
            I understand my temp name is visible to room members but my real profile is hidden.
          </span>
        </label>

        {error && (
          <p className="mb-3 rounded-lg border border-[rgba(196,131,42,0.3)] bg-[rgba(196,131,42,0.08)] px-3 py-2 text-[11px] text-[var(--cream)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleEnter}
          className="w-full rounded-xl py-3 text-sm font-bold text-[#1A0E03] transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg,#C4832A,#A45E18)',
            boxShadow: '0 4px 16px rgba(196,131,42,0.35)',
          }}
        >
          Enter group
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 w-full rounded-xl py-2 text-[12px] text-[var(--cream-muted)] transition-colors hover:text-[var(--cream)]"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
