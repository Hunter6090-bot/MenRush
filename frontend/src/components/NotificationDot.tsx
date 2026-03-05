import React from 'react';

interface NotificationDotProps {
  count?: number;
  visible?: boolean;
  className?: string;
}

export const NotificationDot: React.FC<NotificationDotProps> = ({
  count,
  visible = true,
  className = '',
}) => {
  if (!visible) return null;

  return (
    <span
      className={`absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-[#FF6B6B] text-white font-bold leading-none border-2 border-[#0F1115] ${
        count && count > 0 ? 'min-w-[18px] h-[18px] text-[10px] px-1' : 'w-2.5 h-2.5'
      } ${className}`}
    >
      {count && count > 0 ? (count > 99 ? '99+' : count) : null}
    </span>
  );
};
