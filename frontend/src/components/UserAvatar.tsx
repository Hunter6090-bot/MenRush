import React, { useEffect, useState } from 'react';
import {
  fallbackAvatarForAge,
  isUploadPath,
  resolveAssetUrl,
  resolveUploadUrlCandidates,
} from '../lib/assetUrl';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface UserAvatarProps {
  name: string;
  photoUrl?: string;
  age?: number;
  online?: boolean;
  size?: Size;
  showStatus?: boolean;
  className?: string;
}

const sizes: Record<Size, { outer: string; text: string; dot: string; dotPos: string }> = {
  xs: { outer: 'w-7 h-7', text: 'text-xs', dot: 'w-2 h-2', dotPos: 'bottom-0 right-0' },
  sm: { outer: 'w-9 h-9', text: 'text-sm', dot: 'w-2.5 h-2.5', dotPos: 'bottom-0 right-0' },
  md: { outer: 'w-11 h-11', text: 'text-base', dot: 'w-3 h-3', dotPos: 'bottom-0.5 right-0.5' },
  lg: { outer: 'w-16 h-16', text: 'text-xl', dot: 'w-3.5 h-3.5', dotPos: 'bottom-0.5 right-0.5' },
  xl: { outer: 'w-24 h-24', text: 'text-3xl', dot: 'w-4 h-4', dotPos: 'bottom-1 right-1' },
};

export const getPhotoUrl = (url?: string) => resolveAssetUrl(url);

/**
 * Walk upload URL candidates (API host ↔ same-origin rewrite) before generic fallback.
 * Keeps real /uploads photos visible when Vercel rewrite and VITE_API_URL disagree.
 */
export function useResolvingPhotoSrc(
  photoUrl?: string | null,
  age?: number,
): { src: string | undefined; onError: () => void } {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [phase, setPhase] = useState<'candidates' | 'generic' | 'empty'>('candidates');

  const candidates = resolveUploadUrlCandidates(photoUrl);

  useEffect(() => {
    setCandidateIdx(0);
    setPhase('candidates');
  }, [photoUrl]);

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

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  photoUrl,
  age,
  online,
  size = 'md',
  showStatus = true,
  className = '',
}) => {
  const s = sizes[size];
  const initial = name?.[0]?.toUpperCase() ?? '?';
  const { src, onError } = useResolvingPhotoSrc(photoUrl, age);

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div
        className={`${s.outer} rounded-full overflow-hidden bg-gradient-to-br from-[#C4832A]/30 to-[#C4832A]/10 border border-[#3D2B0E] flex items-center justify-center font-semibold text-[#F0E0C0]`}
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
      {showStatus && online !== undefined && (
        <StatusDot online={online} className={`absolute ${s.dotPos} ${s.dot}`} />
      )}
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
