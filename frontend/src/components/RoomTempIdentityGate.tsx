import React, { useEffect, useRef, useState } from 'react';
import { roomsAPI } from '../api/client';

export interface RoomTempIdentityPayload {
  displayName: string;
  photoUrl?: string;
  saveName: boolean;
  savePhoto: boolean;
}

interface RoomTempIdentityGateProps {
  roomId: string;
  roomName: string;
  roomDescription?: string;
  /** Optional host rules / conditions shown before entry. */
  roomRules?: string | null;
  onReady: (identity: RoomTempIdentityPayload) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Gate before entering a group video room.
 * Temporary name (required) + optional photo; never writes the main profile.
 */
export const RoomTempIdentityGate: React.FC<RoomTempIdentityGateProps> = ({
  roomId,
  roomName,
  roomDescription,
  roomRules,
  onReady,
  onCancel,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [saveName, setSaveName] = useState(false);
  const [savePhoto, setSavePhoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    roomsAPI
      .getTempIdentity(roomId)
      .then((res) => {
        const data = res.data as {
          display_name?: string | null;
          photo_url?: string | null;
          save_name?: boolean;
          save_photo?: boolean;
        };
        if (data.display_name) setDisplayName(data.display_name);
        if (data.photo_url) setPhotoUrl(data.photo_url);
        if (data.save_name) setSaveName(true);
        if (data.save_photo) setSavePhoto(true);
      })
      .catch(() => {});
  }, [roomId]);

  const handleClearSaved = async () => {
    setError(null);
    try {
      await roomsAPI.deleteTempIdentity(roomId);
      setDisplayName('');
      setPhotoUrl(undefined);
      setSaveName(false);
      setSavePhoto(false);
    } catch {
      setError('Could not clear saved identity.');
    }
  };

  const handlePhotoPick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await roomsAPI.uploadTempPhoto(roomId, file);
      setPhotoUrl(res.data.photo_url);
    } catch {
      setError('Could not upload photo. Try another image.');
    } finally {
      setUploading(false);
    }
  };

  const handleEnter = async () => {
    const name = displayName.trim();
    if (!name) {
      setError('Temporary display name is required.');
      return;
    }
    if (name.length < 2 || name.length > 40) {
      setError('Display name must be 2–40 characters.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onReady({
        displayName: name,
        photoUrl,
        saveName,
        savePhoto,
      });
    } catch {
      setError('Could not enter the group. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-10"
      data-testid="room-temp-identity-gate"
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'rgba(196,131,42,0.35)',
        }}
      >
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
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#A89070]">
              Video group
            </span>
          </div>
        </div>

        {roomDescription ? (
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--cream-muted)]">{roomDescription}</p>
        ) : null}

        <div
          className="mb-4 rounded-xl p-3 text-[11px] leading-relaxed text-[#A89070]"
          style={{ background: 'rgba(196,131,42,0.06)', border: '1px solid rgba(196,131,42,0.15)' }}
        >
          <p className="mb-1 font-bold uppercase tracking-wider text-[#C4832A]">Before you enter</p>
          <p>
            This is a video group. For anonymity you can use a temporary name and photo that
            disappear when you leave.
          </p>
          {roomRules ? (
            <p className="mt-2 whitespace-pre-wrap text-[var(--cream-muted)]">{roomRules}</p>
          ) : (
            <ul className="mt-2 list-inside list-disc space-y-0.5">
              <li>Be respectful — harassment gets you removed.</li>
              <li>No sharing personal info (numbers, addresses).</li>
              <li>Adults only. Your account stays accountable.</li>
            </ul>
          )}
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--cream-muted)]">
            Temporary display name *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Anonymous Bear"
            maxLength={40}
            data-testid="room-temp-name"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[#4A3520] outline-none focus:ring-1 focus:ring-[rgba(196,131,42,0.5)]"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              caretColor: '#C4832A',
            }}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--cream-muted)]">
            Temporary photo (optional)
          </label>
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                color: '#C4832A',
              }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (displayName.trim().slice(0, 1) || '?').toUpperCase()
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => void handlePhotoPick(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-[11px] font-bold text-[var(--cream)] hover:border-[var(--copper)]"
              >
                {uploading ? 'Uploading…' : photoUrl ? 'Change photo' : 'Gallery / camera'}
              </button>
              {photoUrl ? (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(undefined)}
                  className="text-left text-[10px] text-[var(--cream-muted)] hover:text-[var(--cream)]"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <label className="mb-2 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={saveName}
            onChange={(e) => setSaveName(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#C4832A]"
            data-testid="room-temp-save-name"
          />
          <span className="text-[11px] leading-relaxed text-[var(--cream-muted)]">
            Save this temporary name for this group next time
          </span>
        </label>

        <label className="mb-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={savePhoto}
            onChange={(e) => setSavePhoto(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#C4832A]"
            data-testid="room-temp-save-photo"
          />
          <span className="text-[11px] leading-relaxed text-[var(--cream-muted)]">
            Save this temporary photo for this group next time
          </span>
        </label>

        {error ? (
          <p className="mb-3 rounded-lg border border-[rgba(196,131,42,0.3)] bg-[rgba(196,131,42,0.08)] px-3 py-2 text-[11px] text-[var(--cream)]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleEnter()}
          disabled={submitting || uploading}
          data-testid="room-temp-enter"
          className="w-full rounded-xl py-3 text-sm font-bold text-[#1A0E03] transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg,#C4832A,#A45E18)',
            boxShadow: '0 4px 16px rgba(196,131,42,0.35)',
          }}
        >
          {submitting ? 'Entering…' : 'Enter group'}
        </button>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 w-full rounded-xl py-2 text-[12px] text-[var(--cream-muted)] transition-colors hover:text-[var(--cream)]"
          >
            Cancel
          </button>
        ) : null}

        {(saveName || savePhoto || displayName || photoUrl) ? (
          <button
            type="button"
            onClick={() => void handleClearSaved()}
            className="mt-2 w-full rounded-xl py-2 text-[11px] text-[var(--cream-muted)] underline-offset-2 hover:text-[var(--cream)] hover:underline"
            data-testid="room-temp-clear-saved"
          >
            Clear saved identity for this group
          </button>
        ) : null}
      </div>
    </div>
  );
};
