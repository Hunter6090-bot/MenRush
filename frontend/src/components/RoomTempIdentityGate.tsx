import React, { useEffect, useMemo, useRef, useState } from 'react';
import { roomsAPI } from '../api/client';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { roomLetterAvatar } from '../lib/roomLetterAvatar';
import { getPhotoUrl } from './UserAvatar';
import { SelfieCaptureModal } from './SelfieCaptureModal';

/** Gate result: explicit profile path, or temp name (+ optional photo). */
export type RoomIdentityGateResult =
  | { mode: 'profile' }
  | {
      mode: 'temp';
      displayName: string;
      /** Empty when the user skips a temp photo — tiles use a letter avatar. */
      photoUrl: string;
      saveName: boolean;
      savePhoto: boolean;
    };

/** @deprecated Use RoomIdentityGateResult — kept for older imports. */
export type RoomTempIdentityPayload = Extract<RoomIdentityGateResult, { mode: 'temp' }>;

interface RoomTempIdentityGateProps {
  roomId: string;
  roomName: string;
  roomDescription?: string;
  /** Optional host rules / conditions shown in House rules accordion. */
  roomRules?: string | null;
  /** Optional live/active count for the subtitle (e.g. "12 active"). */
  activeCount?: number | null;
  /**
   * Optional tribe/theme hint for name suggestion chips (e.g. "Bears & Cubs").
   * When omitted, chips use a short safe generic list — never invents user age/location.
   */
  roomTheme?: string | null;
  /** Real profile identity for the "keep using my real profile" choice. */
  profileName?: string | null;
  profilePhotoUrl?: string | null;
  onReady: (identity: RoomIdentityGateResult) => void | Promise<void>;
  onCancel?: () => void;
}

const DANGER = '#B0432E';
const NAME_MAX = 40;
const NAME_MIN = 2;

const GENERIC_SUGGESTIONS = ['Anon Guest', 'Just Visiting', 'Discreet', 'Incognito'] as const;

const THEME_CHIP_MAP: Array<{ match: RegExp; chips: string[] }> = [
  { match: /bear|cub|otter/i, chips: ['Anon Bear', 'Cub NW', 'Otter Quiet'] },
  { match: /leather|gear|harness/i, chips: ['Gear Bear', 'Leather Kit', 'Boot Play'] },
  { match: /daddy|silver|fox/i, chips: ['Silver Fox', 'Daddy Quiet', 'Age Gap'] },
  { match: /muscle|jock|gym/i, chips: ['Gym Jock', 'Muscle Anon', 'Locker'] },
  { match: /twink|twunk/i, chips: ['Twink Anon', 'Lean Quiet', 'Twunk'] },
  { match: /smoker|cigar/i, chips: ['Smoke Break', 'Cigar Anon', 'Ash Quiet'] },
  { match: /discreet|dl\b/i, chips: ['Discreet', 'Low Profile', 'DL Anon'] },
  { match: /group\s*play|multi/i, chips: ['Group Anon', 'Open Room', 'Join Quiet'] },
  { match: /kink|pig/i, chips: ['Kink Anon', 'Pig Quiet', 'Heavy Play'] },
  { match: /host/i, chips: ['Hosting', 'Guest Anon', 'Drop In'] },
];

function roomInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
    .map((w) => w.replace(/[^A-Za-z0-9]/g, '')[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Build 3 suggestion labels; Shuffle draws from an expanded pool. */
export function buildNameSuggestions(theme?: string | null): string[] {
  const source = theme?.trim() || '';
  if (source) {
    for (const entry of THEME_CHIP_MAP) {
      if (entry.match.test(source)) return entry.chips.slice(0, 3);
    }
  }
  return [...GENERIC_SUGGESTIONS].slice(0, 3);
}

function shufflePool(theme?: string | null): string[] {
  const matched = THEME_CHIP_MAP.find((e) => theme && e.match.test(theme));
  const pool = matched
    ? [...matched.chips, 'Anon Guest', 'Quiet One', 'Just Watching']
    : [...GENERIC_SUGGESTIONS, 'Quiet One', 'Just Watching', 'Pass Through'];
  // Fisher–Yates
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

function defaultHouseRules(): string[] {
  return [
    'Be respectful — harassment gets you removed.',
    'No sharing personal info (numbers, addresses).',
    'Adults only. Your account stays accountable.',
  ];
}

/** Resolve avatar src — blob/data/brand stay same-origin; /uploads go via API host. */
export function resolveTempPhotoSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/brand/') ||
    trimmed.startsWith('/avatars/')
  ) {
    return trimmed;
  }
  return getPhotoUrl(trimmed) ?? trimmed;
}

/**
 * Gate before entering a group video room.
 * Clear choice: keep real profile, OR use a temporary name (photo optional).
 * Missing temp photo → letter avatar from the temp name — never blocks join.
 * Layout: mobile bottom sheet; ≥1280px two-column centred dialog (1a).
 */
export const RoomTempIdentityGate: React.FC<RoomTempIdentityGateProps> = ({
  roomId,
  roomName,
  roomDescription,
  roomRules,
  activeCount,
  roomTheme,
  profileName,
  profilePhotoUrl,
  onReady,
  onCancel,
}) => {
  const isWide = useMediaQuery('(min-width: 1280px)');
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [saveForNext, setSaveForNext] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hadSavedIdentity, setHadSavedIdentity] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(() =>
    buildNameSuggestions(roomTheme || roomName),
  );

  const nameRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const localPreviewRef = useRef<string | null>(null);

  const revokeLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
  };

  useEffect(() => () => revokeLocalPreview(), []);

  useEffect(() => {
    setSuggestions(buildNameSuggestions(roomTheme || roomName));
  }, [roomTheme, roomName]);

  useEffect(() => {
    let cancelled = false;
    roomsAPI
      .getTempIdentity(roomId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data as {
          display_name?: string | null;
          photo_url?: string | null;
          save_name?: boolean;
          save_photo?: boolean;
        };
        const hasSaved = Boolean(data.display_name || data.photo_url);
        if (data.display_name) setDisplayName(data.display_name);
        if (data.photo_url) {
          setPhotoUrl(data.photo_url);
          setPhotoPreview(resolveTempPhotoSrc(data.photo_url));
        }
        if (data.save_name || data.save_photo) setSaveForNext(true);
        if (hasSaved) {
          setHadSavedIdentity(true);
          setRulesOpen(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const trimmed = displayName.trim();
  const nameTooShort = trimmed.length > 0 && trimmed.length < NAME_MIN;
  const nameEmpty = trimmed.length === 0;
  const nameInvalid = nameEmpty || nameTooShort || trimmed.length > NAME_MAX;
  const showNameError = nameTouched && nameInvalid;
  const nameErrorText = nameEmpty
    ? 'Use 2 characters or more.'
    : nameTooShort
      ? 'Use 2 characters or more.'
      : trimmed.length > NAME_MAX
        ? `Use ${NAME_MAX} characters or fewer.`
        : null;

  const canEnter = !nameInvalid && !uploading && !submitting;
  const showChips = loaded && !hadSavedIdentity;
  const subtitleActive =
    typeof activeCount === 'number' && activeCount > 0
      ? `Video group · ${activeCount} active`
      : 'Video group';

  const houseRuleLines = useMemo(() => {
    if (roomRules?.trim()) {
      return roomRules
        .split(/\n+/)
        .map((l) => l.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
    }
    return defaultHouseRules();
  }, [roomRules]);

  const setSaveBoth = (next: boolean) => {
    setSaveForNext(next);
  };

  const handleClearSaved = async () => {
    setMenuOpen(false);
    setFormError(null);
    try {
      await roomsAPI.deleteTempIdentity(roomId);
      revokeLocalPreview();
      setDisplayName('');
      setPhotoUrl(undefined);
      setPhotoPreview(undefined);
      setSaveForNext(false);
      setHadSavedIdentity(false);
      setNameTouched(false);
      setSuggestions(buildNameSuggestions(roomTheme || roomName));
    } catch {
      setFormError('Could not clear saved identity.');
    }
  };

  const handlePhotoPick = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Choose an image file (JPEG, PNG, or WebP).');
      return;
    }
    setFormError(null);
    setUploading(true);

    revokeLocalPreview();
    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setPhotoPreview(localUrl);

    try {
      const res = await roomsAPI.uploadTempPhoto(roomId, file);
      const serverUrl = res?.data?.photo_url;
      if (!serverUrl) {
        throw new Error('missing_photo_url');
      }
      // Payload keeps the server path; avatar keeps the local object URL so the
      // preview always updates (API /uploads may be on another origin).
      setPhotoUrl(serverUrl);
      setPhotoPreview(localUrl);
    } catch {
      revokeLocalPreview();
      setPhotoUrl(undefined);
      setPhotoPreview(undefined);
      setFormError('Could not upload photo. Try another image.');
    } finally {
      setUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    revokeLocalPreview();
    setPhotoUrl(undefined);
    setPhotoPreview(undefined);
    setFormError(null);
  };

  const handleEnter = async () => {
    setNameTouched(true);
    if (nameInvalid) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await onReady({
        mode: 'temp',
        displayName: trimmed,
        photoUrl: photoUrl || '',
        saveName: saveForNext,
        savePhoto: saveForNext,
      });
    } catch {
      setFormError('Could not enter the group. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseProfile = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await onReady({ mode: 'profile' });
    } catch {
      setFormError('Could not enter the group. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resolvedProfileName = (profileName || '').trim() || 'Your profile';
  const resolvedProfilePhoto = resolveTempPhotoSrc(profilePhotoUrl);
  const profileCtaLabel = `Keep using ${resolvedProfileName}`;

  const ctaLabel = hadSavedIdentity && trimmed.length >= NAME_MIN
    ? `Enter as ${trimmed}`
    : 'Enter group';

  const avatarContent = () => {
    if (uploading) {
      return (
        <span className="flex flex-col items-center justify-center gap-1" aria-live="polite">
          <span
            className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(196,131,42,0.25)] border-t-[#C4832A]"
            aria-hidden
          />
        </span>
      );
    }
    if (photoPreview || photoUrl) {
      return (
        <img
          src={photoPreview || resolveTempPhotoSrc(photoUrl)}
          alt=""
          className="h-full w-full object-cover"
          data-testid="room-temp-photo-preview"
        />
      );
    }
    if (trimmed) {
      return <span className="text-2xl font-bold text-[#C4832A]">{roomLetterAvatar(trimmed)}</span>;
    }
    return <span className="text-2xl font-semibold text-[#A89070]">?</span>;
  };

  const anonymityLine = (
    <p className="flex items-center justify-center gap-1.5 text-[11px] leading-snug text-[#A89070]">
      <LockIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <span>Temporary name stays in this room only. Photo optional.</span>
    </p>
  );

  const profileChoice = (
    <div data-testid="room-identity-profile-choice">
      <button
        type="button"
        data-testid="room-use-real-profile"
        disabled={submitting || uploading}
        onClick={() => void handleUseProfile()}
        className="flex w-full items-center gap-3 rounded-xl border border-[rgba(196,131,42,0.4)] px-3 py-3 text-left transition-colors hover:bg-[rgba(196,131,42,0.1)] disabled:opacity-50"
        style={{ background: 'rgba(196,131,42,0.06)' }}
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid rgba(196,131,42,0.35)',
            color: '#C4832A',
          }}
          aria-hidden
        >
          {resolvedProfilePhoto ? (
            <img src={resolvedProfilePhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            roomLetterAvatar(resolvedProfileName)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-[var(--cream)]">{profileCtaLabel}</span>
          <span className="mt-0.5 block text-[11px] text-[#A89070]">
            Enter with your real name and photo
          </span>
        </span>
      </button>
      <div className="my-4 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--border-default)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#A89070]">or</span>
        <span className="h-px flex-1 bg-[var(--border-default)]" />
      </div>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C4832A]">
        Use a temporary name
      </p>
    </div>
  );

  const overflowMenu = (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="More options"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#A89070] transition-colors hover:bg-[rgba(196,131,42,0.1)] hover:text-[var(--cream)]"
      >
        <MoreVertIcon className="h-5 w-5" />
      </button>
      {menuOpen ? (
        <div
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--border-default)] py-1 shadow-lg"
          style={{ background: 'var(--bg-card)' }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="room-temp-clear-saved"
            onClick={() => void handleClearSaved()}
            className="w-full px-3 py-2.5 text-left text-[13px] text-[var(--cream)] transition-colors hover:bg-[rgba(176,67,46,0.12)] hover:text-[#B0432E]"
          >
            Clear saved identity
          </button>
        </div>
      ) : null}
    </div>
  );

  const headerBlock = (
    <div className="relative flex items-start gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{
          background: 'linear-gradient(135deg,rgba(196,131,42,0.35),rgba(139,69,19,0.25))',
          border: '1px solid rgba(196,131,42,0.45)',
          color: '#C4832A',
        }}
        aria-hidden
      >
        {roomInitials(roomName)}
      </div>
      <div className="min-w-0 flex-1 pr-2">
        <p className="truncate text-[15px] font-bold leading-tight text-[var(--cream)]">{roomName}</p>
        <p className="mt-0.5 text-[12px] text-[#A89070]">{subtitleActive}</p>
      </div>
      {overflowMenu}
    </div>
  );

  const identityPreview = (
    <div className="flex items-center gap-3">
      <div
        className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid rgba(196,131,42,0.35)',
        }}
        aria-label={uploading ? 'Uploading photo' : 'Temporary avatar preview'}
      >
        {avatarContent()}
      </div>
      <div className="min-w-0 flex-1">
        {uploading ? (
          <p className="text-[15px] font-semibold text-[var(--cream)]">Uploading photo…</p>
        ) : hadSavedIdentity && trimmed ? (
          <>
            <div className="flex items-center gap-2">
              <p className="truncate text-[16px] font-bold text-[var(--cream)]">{trimmed}</p>
              <button
                type="button"
                onClick={() => {
                  nameRef.current?.focus();
                  nameRef.current?.select();
                }}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#C4832A] hover:bg-[rgba(196,131,42,0.12)]"
              >
                Edit
              </button>
            </div>
            <p className="mt-0.5 text-[12px] text-[#A89070]">Temporary · gone when you leave</p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-bold text-[var(--cream)]">
              {trimmed || 'Pick a name'}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-[#A89070]">
              Optional photo — without one, peers see your letter avatar.
            </p>
          </>
        )}
      </div>
    </div>
  );

  const nameField = (
    <div>
      <label
        htmlFor="room-temp-name"
        className="mb-1.5 block text-[11px] font-semibold text-[#A89070]"
      >
        Temporary name
      </label>
      <div className="relative">
        <input
          id="room-temp-name"
          ref={nameRef}
          type="text"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value.slice(0, NAME_MAX));
            setFormError(null);
          }}
          onBlur={() => setNameTouched(true)}
          placeholder="e.g. Anon Bear"
          maxLength={NAME_MAX}
          autoComplete="off"
          enterKeyHint="done"
          data-testid="room-temp-name"
          className="w-full rounded-xl py-3 pl-4 pr-14 text-[16px] text-[var(--cream)] placeholder-[#4A3520] outline-none transition-shadow"
          style={{
            background: 'var(--bg-primary)',
            border: showNameError
              ? `1px solid ${DANGER}`
              : '1px solid var(--border-default)',
            caretColor: '#C4832A',
            fontSize: '16px',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleEnter();
            }
          }}
        />
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] tabular-nums text-[#A89070]"
          aria-live="polite"
        >
          {displayName.length}/{NAME_MAX}
        </span>
      </div>
      {showNameError && nameErrorText ? (
        <p className="mt-1.5 text-[12px] font-medium" style={{ color: DANGER }} role="alert">
          {nameErrorText}
        </p>
      ) : null}
    </div>
  );

  const suggestionChips = showChips ? (
    <div className="flex flex-wrap gap-2" data-testid="room-temp-suggestions">
      {suggestions.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            setDisplayName(label.slice(0, NAME_MAX));
            setNameTouched(true);
            setFormError(null);
          }}
          className="rounded-full border border-[rgba(196,131,42,0.35)] px-3 py-1.5 text-[13px] font-medium text-[var(--cream)] transition-colors hover:border-[#C4832A] hover:bg-[rgba(196,131,42,0.1)]"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        aria-label="Shuffle name suggestions"
        onClick={() => setSuggestions(shufflePool(roomTheme || roomName))}
        className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.35)] px-3 py-1.5 text-[13px] font-medium text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.1)]"
      >
        <ShuffleIcon className="h-3.5 w-3.5" />
        Shuffle
      </button>
    </div>
  ) : null;

  const photoControls = (
    <div>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="room-temp-gallery-input"
        onChange={(e) => void handlePhotoPick(e.target.files?.[0] ?? null)}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={uploading}
          data-testid="room-temp-take-photo"
          onClick={() => {
            setFormError(null);
            setCameraOpen(true);
          }}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] text-[14px] font-semibold text-[var(--cream)] transition-colors hover:border-[#C4832A] disabled:opacity-50"
        >
          <CameraIcon className="h-4 w-4 text-[#C4832A]" />
          Take photo
        </button>
        <button
          type="button"
          disabled={uploading}
          data-testid="room-temp-upload"
          onClick={() => galleryInputRef.current?.click()}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] text-[14px] font-semibold text-[var(--cream)] transition-colors hover:border-[#C4832A] disabled:opacity-50"
        >
          {uploading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(196,131,42,0.25)] border-t-[#C4832A]" />
              Upload…
            </>
          ) : (
            <>
              <UploadIcon className="h-4 w-4 text-[#C4832A]" />
              Upload
            </>
          )}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#A89070]">
          Optional temporary photo — never your profile face.
        </p>
        {photoUrl || photoPreview ? (
          <button
            type="button"
            data-testid="room-temp-remove-photo"
            onClick={handleRemovePhoto}
            className="shrink-0 text-[11px] font-semibold text-[#A89070] underline-offset-2 hover:text-[var(--cream)] hover:underline"
          >
            Remove photo
          </button>
        ) : null}
      </div>
    </div>
  );

  const saveToggle = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-[var(--cream)]">
          Save your group profile name and picture for next time
        </p>
        <p className="mt-0.5 text-[11px] text-[#A89070]">Kept 30 days. Clear anytime.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={saveForNext}
        onClick={() => setSaveBoth(!saveForNext)}
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4832A]"
        style={{ background: saveForNext ? '#C4832A' : 'var(--border-default)' }}
        data-testid="room-temp-save-name"
        aria-label="Save your group profile name and picture for next time"
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            saveForNext ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {/* Mirror test-id for savePhoto — same single toggle controls both flags */}
      <input
        type="checkbox"
        className="sr-only"
        checked={saveForNext}
        readOnly
        tabIndex={-1}
        aria-hidden
        data-testid="room-temp-save-photo"
      />
    </div>
  );

  const houseRulesAccordion = (
    <div
      className="rounded-xl border border-[rgba(196,131,42,0.2)]"
      style={{ background: 'rgba(196,131,42,0.05)' }}
    >
      <button
        type="button"
        aria-expanded={rulesOpen}
        onClick={() => setRulesOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
        data-testid="room-temp-house-rules-toggle"
      >
        <span className="text-[13px] font-bold text-[var(--cream)]">House rules</span>
        <ChevronIcon className={`h-4 w-4 text-[#A89070] transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
      </button>
      {rulesOpen ? (
        <div className="border-t border-[rgba(196,131,42,0.15)] px-3 pb-3 pt-2" data-testid="room-temp-house-rules">
          {roomDescription ? (
            <p className="mb-2 text-[12px] leading-relaxed text-[#A89070]">{roomDescription}</p>
          ) : null}
          <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-[var(--cream-muted)]">
            {houseRuleLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  const formErrorBanner = formError ? (
    <p className="rounded-lg px-3 py-2 text-[12px] font-medium" style={{ color: DANGER, background: 'rgba(176,67,46,0.1)', border: `1px solid ${DANGER}` }} role="alert">
      {formError}
    </p>
  ) : null;

  const enterButton = (
    <button
      type="button"
      onClick={() => void handleEnter()}
      disabled={!canEnter}
      data-testid="room-temp-enter"
      className="w-full rounded-xl py-3.5 text-[15px] font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed"
      style={
        canEnter
          ? {
              background: 'linear-gradient(135deg,#C4832A,#A45E18)',
              color: '#1A0E03',
              boxShadow: '0 4px 16px rgba(196,131,42,0.35)',
            }
          : {
              background: 'rgba(74,53,32,0.55)',
              color: '#6B5840',
              boxShadow: 'none',
            }
      }
    >
      {submitting ? 'Entering…' : ctaLabel}
    </button>
  );

  const notNowButton = onCancel ? (
    <button
      type="button"
      onClick={onCancel}
      data-testid="room-temp-not-now"
      className="w-full py-2 text-center text-[13px] font-medium text-[#A89070] transition-colors hover:text-[var(--cream)] min-[1280px]:w-auto min-[1280px]:rounded-xl min-[1280px]:border min-[1280px]:border-[var(--border-default)] min-[1280px]:bg-[rgba(0,0,0,0.25)] min-[1280px]:px-5 min-[1280px]:py-3"
    >
      Not now
    </button>
  ) : null;

  /* ── Mobile form body (scrollable) ─────────────────────────────────────── */
  const mobileFormBody = (
    <div className="flex flex-col gap-4 px-5 pb-4 pt-2">
      {profileChoice}
      {identityPreview}
      {nameField}
      {suggestionChips}
      {photoControls}
      {saveToggle}
      {houseRulesAccordion}
      {formErrorBanner}
    </div>
  );

  /* ── Web left column ───────────────────────────────────────────────────── */
  const webLeftColumn = (
    <div
      className="flex h-full flex-col justify-between gap-6 p-7"
      style={{ background: 'rgba(0,0,0,0.28)' }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg,rgba(196,131,42,0.35),rgba(139,69,19,0.25))',
              border: '1px solid rgba(196,131,42,0.45)',
              color: '#C4832A',
            }}
          >
            {roomInitials(roomName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold text-[var(--cream)]">{roomName}</p>
            <p className="text-[12px] text-[#A89070]">{subtitleActive}</p>
          </div>
        </div>
        {roomDescription ? (
          <p className="text-[13px] leading-relaxed text-[#A89070]">{roomDescription}</p>
        ) : null}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C4832A]">
            House rules
          </p>
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-[var(--cream-muted)]">
            {houseRuleLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="pt-2">{anonymityLine}</div>
    </div>
  );

  /* ── Web right form ────────────────────────────────────────────────────── */
  const webRightForm = (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 space-y-4 overflow-y-auto p-7">
        <div className="absolute right-4 top-4">{overflowMenu}</div>
        {profileChoice}
        {identityPreview}
        {nameField}
        {suggestionChips}
        {photoControls}
        {saveToggle}
        {formErrorBanner}
      </div>
      <div
        className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border-default)] px-7 py-4"
        style={{ background: 'rgba(0,0,0,0.12)' }}
      >
        {notNowButton}
        <div className="min-w-[160px]">{enterButton}</div>
      </div>
    </div>
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="room-temp-identity-gate"
      style={{ background: 'var(--bg-primary)' }}
    >
      {isWide ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="pointer-events-none absolute inset-0 bg-black/50" aria-hidden />
          <div
            className="relative grid w-full max-w-[920px] overflow-hidden rounded-2xl border border-[rgba(196,131,42,0.3)] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
            style={{
              background: 'var(--bg-card)',
              gridTemplateColumns: 'minmax(280px, 0.92fr) minmax(340px, 1.08fr)',
              minHeight: '520px',
              maxHeight: 'min(860px, 90vh)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Temporary identity"
          >
            {webLeftColumn}
            {webRightForm}
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col justify-end">
          <div
            className="pointer-events-none absolute inset-0 bg-black/45"
            aria-hidden
          />
          <div
            className="relative flex max-h-[min(92dvh,920px)] min-h-[min(72dvh,680px)] w-full flex-col rounded-t-[28px] border border-b-0 border-[rgba(196,131,42,0.28)] shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
            style={{
              background: 'var(--bg-card)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Temporary identity"
          >
            <div className="flex shrink-0 justify-center pb-1 pt-3" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-[rgba(168,144,112,0.45)]" />
            </div>
            <div className="shrink-0 px-5 pb-3 pt-1">{headerBlock}</div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{mobileFormBody}</div>
            <div
              className="shrink-0 space-y-2 border-t border-[var(--border-default)] px-5 pb-3 pt-3"
              style={{ background: 'var(--bg-card)' }}
            >
              {enterButton}
              {notNowButton}
              {anonymityLine}
            </div>
          </div>
        </div>
      )}

      <SelfieCaptureModal
        variant="compact"
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          setCameraOpen(false);
          void handlePhotoPick(file);
        }}
        onError={(message) => {
          setCameraOpen(false);
          setFormError(message || 'Could not open the camera.');
        }}
        ariaLabel="Take a temporary group photo"
        filePrefix="room-temp"
        captureLabel="Use photo"
        instruction="This photo stays in this group only."
      />
    </div>
  );
};

/* ── Inline icons (no new asset deps) ──────────────────────────────────────── */

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function MoreVertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" strokeLinejoin="round" />
      <circle cx="12" cy="14" r="3.25" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 16V4" strokeLinecap="round" />
      <path d="M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

function ShuffleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 3h5v5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20l7-7" strokeLinecap="round" />
      <path d="M21 3l-7 7" strokeLinecap="round" />
      <path d="M21 16v5h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 15l6 6" strokeLinecap="round" />
      <path d="M4 4l5 5" strokeLinecap="round" />
    </svg>
  );
}
