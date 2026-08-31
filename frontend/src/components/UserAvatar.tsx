import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fallbackAvatarForAge,
  resolveAssetUrl,
  resolveDisplayThumbCandidates,
  resolveUploadUrlCandidates,
} from '../lib/assetUrl';
import { profilePathForUser } from '../lib/profileLinks';
import { useAuthStore } from '../hooks/store';

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
 * Walk upload URL candidates (API host ↔ same-origin rewrite) before generic fallback.
 * Keeps real /uploads photos visible when Vercel rewrite and VITE_API_URL disagree.
 */
export function useResolvingPhotoSrc(
  photoUrl?: string | null,
  age?: number,
  options?: ResolvingPhotoOptions,
): { src: string | undefined; onError: () => void } {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [phase, setPhase] = useState<'candidates' | 'generic' | 'empty'>('candidates');
  const displayWidth = options?.displayWidth;

  const candidates =
    displayWidth != null
      ? resolveDisplayThumbCandidates(photoUrl, displayWidth)
      : resolveUploadUrlCandidates(photoUrl);

  useEffect(() => {
    setCandidateIdx(0);
    setPhase('candidates');
  }, [photoUrl, displayWidth]);

  let src: string | undefined;
  if (phase === 'empty') src = undefined;
  else if (phase === 'generic') src = resolveAssetUrl(fallbackAvatarForAge(age));
  else src = candidates[candidateIdx] ?? resolveAssetUrl(photoUrl);

  const onError = () => {
    if (phase === 'candidates' && candidateIdx + 1 < candidates.length) {
      setCandidateIdx((i) => i + 1);
      return;
    }
    // Broken /uploads (volume wipe, 404) → age-based generic face so the map
    // and list still show a person pin, not a blank hole.
    if (phase === 'candidates' && photoUrl) {
      setPhase('generic');
      return;
    }
    if (phase === 'generic') {
      setPhase('empty');
      return;
    }
    setPhase('empty');
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
  const initial = name?.[0]?.toUpperCase() ?? '?';
  const { src, onError } = useResolvingPhotoSrc(photoUrl, age);
  const href = useProfilePhotoHref(userId);
  const shouldLink = Boolean(href) && linkToProfile !== false;

  const face = (
    <div
      className={`${s.outer} rounded-full overflow-hidden bg-gradient-to-br from-[#C4832A]/30 to-[#C4832A]/10 border border-[var(--border-default)] flex items-center justify-center font-semibold text-[var(--cream)]`}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={onError}
          loading="lazy"
        />
      ) : (
        <span className={s.text}>{initial}</span>
      )}
    </div>
  );

  const content = (
    <div className={`relative flex-shrink-0 ${className}`}>
      {face}
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
