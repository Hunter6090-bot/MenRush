import React, { useEffect, useMemo, useRef, useState } from 'react';
import { roomsAPI } from '../api/client';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { getPhotoUrl } from './UserAvatar';
import { BrandAvatar } from './BrandAvatar';
import { FadedBrandFace } from './FadedBrandFace';
import { isPlaceholderAvatarUrl } from '../lib/avatarFallback';
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
  // Fisher Yates shuffle
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

function defaultHouseRules(): string[] {
  return [
    'Be respectful. Harassment gets you removed.',
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
 * Missing temp photo → ONE Brand placeholder face — never blocks join.
 * Layout matches the Claude Design board (Room pre-join): Rooms back, room name,
 * "N in room", big preview card, photo tiles, temp name row, copper Join.
 * Phone: full screen. 1280px and up: two-column dialog. Logic unchanged.
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
    ? `Join as ${trimmed}`
    : 'Join';

  const avatarContent = () => {
    if (uploading) {
      return (
        <span className="flex h-full w-full flex-col items-center justify-center gap-2" aria-live="polite">
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--copper)]"
            aria-hidden
          />
          <span className="text-[15px] font-semibold text-[var(--cream)]">Uploading photo…</span>
        </span>
      );
    }
    if (photoPreview || (photoUrl && !isPlaceholderAvatarUrl(photoUrl))) {
      return (
        <img
          src={photoPreview || resolveTempPhotoSrc(photoUrl)}
          alt=""
          className="h-full w-full object-cover"
          data-testid="room-temp-photo-preview"
        />
      );
    }
    // No temp photo → ONE Brand placeholder (never letter / "?" avatar).
    return (
      <span className="block h-full w-full" data-testid="room-temp-photo-brand-face">
        <FadedBrandFace variant="profile" label={trimmed || 'MenRush'} />
      </span>
    );
  };

  /** Board caption under the Join button. */
  const anonymityLine = (
    <p className="flex items-center justify-center gap-1.5 text-center text-[15px] leading-snug text-[var(--cream-muted)]">
      <LockIcon className="h-4 w-4 shrink-0" />
      <span>Temporary name stays in this room only. Photo optional.</span>
    </p>
  );

  const overflowMenu = (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="More options"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--cream-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--cream)]"
      >
        <MoreVertIcon className="h-5 w-5" />
      </button>
      {menuOpen ? (
        <div
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] py-1 shadow-lg"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="room-temp-clear-saved"
            onClick={() => void handleClearSaved()}
            className="flex min-h-[44px] w-full items-center px-4 text-left text-[15px] text-[var(--cream)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            Clear saved identity
          </button>
        </div>
      ) : null}
    </div>
  );

  /** Board: "‹ Rooms" back, room name, "N in room". */
  const headerBlock = (
    <div>
      <div className="flex items-center justify-between gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            data-testid="room-temp-not-now"
            aria-label="Not now, back to rooms"
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-[15px] font-semibold text-[var(--cream-muted)] transition-colors hover:text-[var(--cream)]"
          >
            <ChevronLeftIcon className="h-5 w-5" />
            Rooms
          </button>
        ) : (
          <span />
        )}
        {overflowMenu}
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <h1 className="min-w-0 truncate text-[26px] font-black leading-tight text-[var(--cream)]">{roomName}</h1>
        {typeof activeCount === 'number' && activeCount > 0 ? (
          <p
            className="flex shrink-0 items-center gap-1.5 pb-1 text-[15px] font-bold text-[var(--nn-accent-text)]"
            data-testid="room-temp-active-count"
          >
            <PersonIcon className="h-4 w-4" />
            {activeCount} in room
          </p>
        ) : null}
      </div>
      {roomDescription ? (
        <p className="mt-1 text-[15px] leading-snug text-[var(--cream-muted)]">{roomDescription}</p>
      ) : null}
    </div>
  );

  /** Board: big preview card with "Preview" and the temp name on chips. */
  const previewCard = (
    <div
      className="relative aspect-square max-h-[44dvh] w-full overflow-hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-primary)] min-[1280px]:max-h-none"
      aria-label={uploading ? 'Uploading photo' : 'Temporary avatar preview'}
      data-testid="room-temp-preview-card"
    >
      {avatarContent()}
      <span className="absolute left-3 top-3 rounded-full bg-[var(--bg-primary)] px-3 py-1 text-[15px] font-bold text-[var(--cream)]">
        Preview
      </span>
      <span
        className="absolute bottom-3 left-3 max-w-[60%] truncate rounded-full bg-[var(--bg-primary)] px-3 py-1 text-[15px] font-bold text-[var(--cream)]"
        data-testid="room-temp-preview-name"
      >
        {trimmed || 'Pick a name'}
      </span>
      {photoUrl || photoPreview ? (
        <button
          type="button"
          data-testid="room-temp-remove-photo"
          onClick={handleRemovePhoto}
          className="absolute bottom-2 right-2 inline-flex min-h-[44px] items-center rounded-full bg-[var(--bg-primary)] px-3 text-[15px] font-semibold text-[var(--cream)]"
        >
          Remove photo
        </button>
      ) : null}
    </div>
  );

  /** Board tiles: Camera / Temp photo. Upload kept so nothing is lost. */
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
          className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[15px] font-bold text-[var(--cream)] transition-colors hover:border-[var(--copper)] disabled:opacity-60"
        >
          <CameraIcon className="h-5 w-5 text-[var(--nn-accent-text)]" />
          Take photo
        </button>
        <button
          type="button"
          disabled={uploading}
          data-testid="room-temp-upload"
          onClick={() => galleryInputRef.current?.click()}
          className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[15px] font-bold text-[var(--cream)] transition-colors hover:border-[var(--copper)] disabled:opacity-60"
        >
          <ImageIcon className="h-5 w-5 text-[var(--nn-accent-text)]" />
          {uploading ? 'Uploading…' : 'Temp photo'}
        </button>
      </div>
      <p className="mt-2 text-[15px] leading-snug text-[var(--cream-muted)]">
        Optional temporary photo, never your profile face. You choose camera and mic inside the room.
      </p>
    </div>
  );

  /** Board row: icon, "Temp name", value. */
  const nameField = (
    <div>
      <p className="mb-2 text-[15px] font-bold text-[var(--nn-accent-text)]">Use a temporary name</p>
      <div
        className={`flex min-h-[52px] items-center gap-3 rounded-2xl border bg-[var(--bg-elevated)] px-4 ${
          showNameError ? 'border-[var(--nn-danger)]' : 'border-[var(--border-default)]'
        }`}
      >
        <TagIcon className="h-5 w-5 shrink-0 text-[var(--nn-accent-text)]" />
        <label htmlFor="room-temp-name" className="shrink-0 text-[15px] text-[var(--cream-muted)]">
          Temporary name
        </label>
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
          className="min-w-0 flex-1 bg-transparent py-3 text-right text-[16px] font-bold text-[var(--cream)] outline-none placeholder:font-normal placeholder:text-[var(--cream-muted)]"
          style={{ caretColor: 'var(--copper)', fontSize: '16px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleEnter();
            }
          }}
        />
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        {showNameError && nameErrorText ? (
          <p className="text-[15px] font-medium text-[var(--nn-danger-text)]" role="alert">
            {nameErrorText}
          </p>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-[15px] tabular-nums text-[var(--cream-muted)]" aria-live="polite">
          {displayName.length}/{NAME_MAX}
        </span>
      </div>
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
          className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--border-default)] px-4 text-[15px] font-medium text-[var(--cream)] transition-colors hover:border-[var(--copper)]"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        aria-label="Shuffle name suggestions"
        onClick={() => setSuggestions(shufflePool(roomTheme || roomName))}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--border-default)] px-4 text-[15px] font-semibold text-[var(--nn-accent-text)] transition-colors hover:border-[var(--copper)]"
      >
        <ShuffleIcon className="h-4 w-4" />
        Shuffle
      </button>
    </div>
  ) : null;

  const saveToggle = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug text-[var(--cream)]">
          Save your group profile name and picture for next time
        </p>
        <p className="mt-0.5 text-[15px] text-[var(--cream-muted)]">Kept 30 days. Clear anytime.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={saveForNext}
        onClick={() => setSaveBoth(!saveForNext)}
        className={`relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)]`}
        data-testid="room-temp-save-name"
        aria-label="Save your group profile name and picture for next time"
      >
        <span
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
            saveForNext ? 'bg-[var(--copper)]' : 'bg-[var(--border-strong)]'
          }`}
          aria-hidden
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-[var(--cream)] shadow-sm transition-transform duration-200 ${
              saveForNext ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </span>
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
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
      <button
        type="button"
        aria-expanded={rulesOpen}
        onClick={() => setRulesOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center justify-between gap-2 px-4 text-left"
        data-testid="room-temp-house-rules-toggle"
      >
        <span className="text-[15px] font-bold text-[var(--cream)]">House rules</span>
        <ChevronIcon className={`h-5 w-5 text-[var(--cream-muted)] transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
      </button>
      {rulesOpen ? (
        <div className="border-t border-[var(--border-default)] px-4 pb-3 pt-2" data-testid="room-temp-house-rules">
          <ul className="list-disc space-y-1 pl-4 text-[15px] leading-relaxed text-[var(--cream-muted)]">
            {houseRuleLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  /** Real-profile path kept (one tap), below the temp form like a secondary row. */
  const profileChoice = (
    <div data-testid="room-identity-profile-choice">
      <div className="mb-3 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--border-default)]" />
        <span className="text-[15px] font-semibold text-[var(--cream-muted)]">or</span>
        <span className="h-px flex-1 bg-[var(--border-default)]" />
      </div>
      <button
        type="button"
        data-testid="room-use-real-profile"
        disabled={submitting || uploading}
        onClick={() => void handleUseProfile()}
        className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-left transition-colors hover:border-[var(--copper)] disabled:opacity-60"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)]"
          aria-hidden
        >
          <BrandAvatar photoUrl={resolvedProfilePhoto} name={resolvedProfileName} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-[var(--cream)]">{profileCtaLabel}</span>
          <span className="mt-0.5 block text-[15px] text-[var(--cream-muted)]">
            Enter with your real name and photo
          </span>
        </span>
      </button>
    </div>
  );

  const formErrorBanner = formError ? (
    <p
      className="rounded-xl border border-[var(--nn-danger)] bg-[var(--error-soft)] px-3 py-2 text-[15px] font-medium text-[var(--nn-danger-text)]"
      role="alert"
    >
      {formError}
    </p>
  ) : null;

  /** Board: full width copper "Join" with an arrow-in icon. */
  const enterButton = (
    <button
      type="button"
      onClick={() => void handleEnter()}
      disabled={!canEnter}
      data-testid="room-temp-enter"
      className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-[17px] font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
        canEnter
          ? 'bg-[var(--copper)] text-[var(--nn-on-copper)] shadow-[0_4px_16px_rgba(196,131,42,0.35)]'
          : 'bg-[var(--bg-elevated)] text-[var(--cream-muted)]'
      }`}
    >
      <JoinIcon className="h-5 w-5" />
      {submitting ? 'Joining…' : ctaLabel}
    </button>
  );

  const formBlocks = (
    <>
      {photoControls}
      {nameField}
      {suggestionChips}
      {saveToggle}
      {houseRulesAccordion}
      {profileChoice}
      {formErrorBanner}
    </>
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[var(--bg-primary)]"
      data-testid="room-temp-identity-gate"
    >
      {isWide ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-8">
          <div
            className="relative grid w-full max-w-[920px] overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
            style={{
              gridTemplateColumns: 'minmax(300px, 0.95fr) minmax(340px, 1.05fr)',
              minHeight: '520px',
              maxHeight: 'min(860px, 90vh)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Temporary identity"
          >
            <div className="flex flex-col gap-4 p-7">
              {headerBlock}
              {previewCard}
            </div>
            <div className="flex min-h-0 flex-col border-l border-[var(--border-default)]">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-7">{formBlocks}</div>
              <div className="shrink-0 space-y-2 border-t border-[var(--border-default)] px-7 py-4">
                {enterButton}
                {anonymityLine}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Temporary identity"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-4 px-5 pb-4 pt-2">
              {headerBlock}
              {previewCard}
              {formBlocks}
            </div>
          </div>
          <div
            className="shrink-0 space-y-2 border-t border-[var(--border-default)] bg-[var(--bg-primary)] px-5 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {enterButton}
            {anonymityLine}
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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="M21 16l-5-5-8 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 12V4h8l10 10-8 8L3 12z" strokeLinejoin="round" />
      <circle cx="7.5" cy="8.5" r="1.25" />
    </svg>
  );
}

function JoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
      <path d="M10 8l4 4-4 4M14 12H4" strokeLinecap="round" strokeLinejoin="round" />
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
