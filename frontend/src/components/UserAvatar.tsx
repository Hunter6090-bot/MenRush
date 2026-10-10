import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  resolveAssetUrl,
  resolveDisplayThumbCandidates,
  resolveUploadUrlCandidates,
} from '../lib/assetUrl';
import { profilePathForUser } from '../lib/profileLinks';
import { useAuthStore } from '../hooks/store';
import { realAvatarUrl } from '../lib/avatarFallback';
import { FadedBrandFace } from './FadedBrandFace';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface UserAvatarProps {
  name: string;
  photoUrl?: string;
  age?: number;
  online?: boolean;
  size?: Size;
  showStatus?: boolean;
  className?: string;
  /**
   * When set, the avatar links to that user's profile (/profile for self,
   * /profile/:id otherwise). New surfaces inherit the product rule by passing userId.
   */
  userId?: string;
  /** Override auto-linking when userId is set (e.g. already wrapped in a Link). */
  linkToProfile?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  'data-testid'?: string;
}

const sizes: Record<Size, { outer: string; text: string; dot: string; dotPos: string }> = {
  xs: { outer: 'w-7 h-7', text: 'text-xs', dot: 'w-2 h-2', dotPos: 'bottom-0 right-0' },
  sm: { outer: 'w-9 h-9', text: 'text-sm', dot: 'w-2.5 h-2.5', dotPos: 'bottom-0 right-0' },
  md: { outer: 'w-11 h-11', text: 'text-base', dot: 'w-3 h-3', dotPos: 'bottom-0.5 right-0.5' },
  lg: { outer: 'w-16 h-16', text: 'text-xl', dot: 'w-3.5 h-3.5', dotPos: 'bottom-0.5 right-0.5' },
  xl: { outer: 'w-24 h-24', text: 'text-3xl', dot: 'w-4 h-4', dotPos: 'bottom-1 right-1' },
};

export const getPhotoUrl = (url?: string) => resolveAssetUrl(url);

export type ResolvingPhotoOptions = {
  /** Prefer `/api/media/display` thumbs (Nearby / Matches grids — iPhone decode). */
  displayWidth?: number;
};

/**
 * Photo URLs that already failed to load in this tab (404, volume wipe, bad
 * stored path). Every remount of an avatar (list refresh, socket update, new
 * screen) used to request the same broken URL again: a 404 is not cached, so one
 * bad photo_url on a busy list meant a fresh /uploads request on every render
 * pass. Now the first failure is remembered for a while and later mounts go
 * straight to the Brand placeholder without a request.
 * Display-only: the stored photo path is never touched (media lock).
 */
export const BROKEN_PHOTO_TTL_MS = 10 * 60 * 1000;
const BROKEN_PHOTO_MAX = 500;
const brokenPhotoSrcs = new Map<string, number>();

export function isKnownBrokenPhotoSrc(src: string, now = Date.now()): boolean {
  const at = brokenPhotoSrcs.get(src);
  if (at == null) return false;
  if (now - at > BROKEN_PHOTO_TTL_MS) {
    brokenPhotoSrcs.delete(src);
    return false;
  }
  return true;
}

export function markBrokenPhotoSrc(src: string, now = Date.now()): void {
  brokenPhotoSrcs.delete(src);
  brokenPhotoSrcs.set(src, now);
  if (brokenPhotoSrcs.size > BROKEN_PHOTO_MAX) {
    const oldest = brokenPhotoSrcs.keys().next().value;
    if (oldest !== undefined) brokenPhotoSrcs.delete(oldest);
  }
}

/** Test hook: forget every remembered failure. */
export function resetBrokenPhotoSrcs(): void {
  brokenPhotoSrcs.clear();
}

/**
 * Walk upload URL candidates (API host ↔ same-origin rewrite) before giving up.
 * Keeps real /uploads photos visible when Vercel rewrite and VITE_API_URL disagree.
 *
 * Empty / legacy default (generic `/avatars/*`, logo plates) → `src` undefined.
 * Every candidate failed → `src` undefined. Callers then render the ONE Brand
 * placeholder (`FadedBrandFace`). No generic SVG / initials fallback (Pete lock).
 * Media lock: the stored photo path is never rewritten — this is display-only.
 */
export function useResolvingPhotoSrc(
  photoUrl?: string | null,
  _age?: number,
  options?: ResolvingPhotoOptions,
): { src: string | undefined; onError: () => void } {
  // Bumped after a failure so the filtered candidate list is re-read.
  const [, setFailures] = useState(0);
  const [failed, setFailed] = useState(false);
  const displayWidth = options?.displayWidth;
  const realUrl = realAvatarUrl(photoUrl);

  const resolved =
    realUrl == null
      ? []
      : displayWidth != null
        ? resolveDisplayThumbCandidates(realUrl, displayWidth)
        : resolveUploadUrlCandidates(realUrl);
  const allCandidates =
    realUrl != null && resolved.length === 0 ? [resolveAssetUrl(realUrl)] : resolved;
  // Skip candidates that already failed in this tab, so a broken photo is not
  // requested again on every remount. The failed one drops out of the list, so
  // the next candidate is always the first one left.
  const candidates = allCandidates.filter(
    (c): c is string => Boolean(c) && !isKnownBrokenPhotoSrc(c as string),
  );

  useEffect(() => {
    setFailed(false);
  }, [realUrl, displayWidth]);

  const src: string | undefined = failed || realUrl == null ? undefined : candidates[0];

  const onError = () => {
    if (src) markBrokenPhotoSrc(src);
    if (candidates.length > 1) {
      setFailures((n) => n + 1);
      return;
    }
    // Broken /uploads (volume wipe, 404) → Brand placeholder, never a legacy default.
    setFailed(true);
  };

  return { src, onError };
}

/** Resolves the href for a face/photo tap (self → /profile, else /profile/:id). */
export function useProfilePhotoHref(userId?: string | null): string | null {
  const authUserId = useAuthStore((s) => s.user?.id);
  if (!userId) return null;
  return profilePathForUser(userId, authUserId);
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  photoUrl,
  age,
  online,
  size = 'md',
  showStatus = true,
  className = '',
  userId,
  linkToProfile,
  onClick,
  'data-testid': testId,
}) => {
  const s = sizes[size];
  const { src, onError } = useResolvingPhotoSrc(photoUrl, age);
  const href = useProfilePhotoHref(userId);
  const shouldLink = Boolean(href) && linkToProfile !== false;

  // Size + rounded-full live on the relative wrapper so className overrides
  // (e.g. !w-[52px]) and rings follow the circle — not a square chrome box.
  const content = (
    <div className={`relative flex-shrink-0 ${s.outer} rounded-full ${className}`}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-gradient-to-br from-[#C4832A]/30 to-[#C4832A]/10 font-semibold text-[var(--cream)]"
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            onError={onError}
            loading="lazy"
          />
        ) : (
          <FadedBrandFace variant="profile" label={name || 'MenRush'} />
        )}
      </div>
      {showStatus && online !== undefined && (
        <StatusDot online={online} className={`absolute ${s.dotPos} ${s.dot}`} />
      )}
    </div>
  );

  if (shouldLink && href) {
    return (
      <Link
        to={href}
        onClick={onClick}
        aria-label={`Open ${name}'s profile`}
        data-testid={testId ?? 'user-avatar-profile-link'}
        className="inline-flex shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)]"
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open ${name}'s profile`}
        data-testid={testId}
        className="inline-flex shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)]"
      >
        {content}
      </button>
    );
  }

  return (
    <div data-testid={testId} className="inline-flex shrink-0">
      {content}
    </div>
  );
};

interface StatusDotProps {
  online: boolean;
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ online, className = '' }) => (
  <span
    className={`rounded-full border-2 border-nn-bg ${online ? 'bg-nn-online' : 'bg-nn-border'} ${className}`}
  />
);
