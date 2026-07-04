import React from 'react';

interface NotificationDotProps {
  count?: number;
  visible?: boolean;
  className?: string;
  'data-testid'?: string;
}

export const NotificationDot: React.FC<NotificationDotProps> = ({
  count,
  visible = true,
  className = '',
  'data-testid': testId,
}) => {
  if (!visible) return null;

  return (
    <span
      data-testid={testId}
      className={`absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-[#8B4513] text-white font-bold leading-none border-2 border-[#0D0A06] ${
        count && count > 0 ? 'min-w-[18px] h-[18px] text-[10px] px-1' : 'w-2.5 h-2.5'
      } ${className}`}
    >
      {count && count > 0 ? (count > 99 ? '99+' : count) : null}
    </span>
  );
};
