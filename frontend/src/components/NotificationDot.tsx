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
      className={`absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-nn-copper text-nn-on-copper font-bold leading-none border-2 border-nn-bg ${
        count && count > 0 ? 'min-w-[20px] h-5 text-[10px] px-1' : 'w-2.5 h-2.5'
      } ${className}`}
    >
      {count && count > 0 ? (count > 99 ? '99+' : count) : null}
    </span>
  );
};
