import React from 'react';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface UserAvatarProps {
  name: string;
  photoUrl?: string;
  online?: boolean;
  size?: Size;
  showStatus?: boolean;
  className?: string;
}

const sizes: Record<Size, { outer: string; text: string; dot: string; dotPos: string }> = {
  xs: { outer: 'w-7 h-7',  text: 'text-xs',  dot: 'w-2 h-2',  dotPos: 'bottom-0 right-0' },
  sm: { outer: 'w-9 h-9',  text: 'text-sm',  dot: 'w-2.5 h-2.5', dotPos: 'bottom-0 right-0' },
  md: { outer: 'w-11 h-11', text: 'text-base', dot: 'w-3 h-3',  dotPos: 'bottom-0.5 right-0.5' },
  lg: { outer: 'w-16 h-16', text: 'text-xl',  dot: 'w-3.5 h-3.5', dotPos: 'bottom-0.5 right-0.5' },
  xl: { outer: 'w-24 h-24', text: 'text-3xl',  dot: 'w-4 h-4',  dotPos: 'bottom-1 right-1' },
};

export const getPhotoUrl = (url?: string) => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl =
    import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
  return `${baseUrl}${url}`;
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  photoUrl,
  online,
  size = 'md',
  showStatus = true,
  className = '',
}) => {
  const s = sizes[size];
  const initial = name?.[0]?.toUpperCase() ?? '?';
  const fullPhotoUrl = getPhotoUrl(photoUrl);

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div
        className={`${s.outer} rounded-full overflow-hidden bg-gradient-to-br from-[#C4832A]/30 to-[#C4832A]/10 border border-[#3D2B0E] flex items-center justify-center font-semibold text-[#F0E0C0]`}
      >
        {fullPhotoUrl ? (
          <img src={fullPhotoUrl} alt={name} className="w-full h-full object-cover" />
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
