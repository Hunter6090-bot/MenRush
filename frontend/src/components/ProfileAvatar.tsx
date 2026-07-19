import React from 'react';
import { resolveAssetUrl } from '../lib/assetUrl';

export type ProfileAvatarProps = {
  photoUrl?: string | null;
  size?: number;
  /** Kept optional so older call sites / test page don't break. */
  bodyType?: string;
  facialHair?: string;
  bodyHair?: string;
  age?: number;
  className?: string;
};

/**
 * Simple bronze-ring avatar: real photo, or uniform blue-grey person silhouette.
 */
const ProfileAvatar = ({
  photoUrl,
  size = 112,
  className = '',
}: ProfileAvatarProps) => {
  const dimension = `${size}px`;
  const resolved = resolveAssetUrl(photoUrl) || photoUrl || undefined;

  if (resolved) {
    return (
      <div
        className={`rounded-full border-4 border-[#C4832A] overflow-hidden bg-[#0D0A06] shadow-inner flex-shrink-0 ${className}`.trim()}
        style={{ width: dimension, height: dimension }}
      >
        <img src={resolved} alt="Profile" className="h-full w-full object-cover" />
      </div>
    );
  }

  // Simple uniform silhouette (same for everyone without a photo)
  return (
    <div
      className={`rounded-full border-4 border-[#C4832A] bg-[#0D0A06] flex items-center justify-center shadow-inner flex-shrink-0 ${className}`.trim()}
      style={{ width: dimension, height: dimension }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="12" cy="8" r="4" fill="#A8B5C8" />
        <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="#A8B5C8" />
      </svg>
    </div>
  );
};

export default ProfileAvatar;
