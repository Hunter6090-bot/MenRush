import React from 'react';

interface StatusBadgeProps {
  online: boolean;
  lastSeen?: string;
  pulsing?: boolean;
  className?: string;
  size?: 'xs' | 'sm';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  online,
  lastSeen,
  pulsing = false,
  className = '',
  size = 'sm',
}) => {
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11.5px]';

  if (pulsing) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider bg-nn-copper text-[#1A0E03] shadow-[0_0_16px_rgba(196,131,42,0.33)] ${pad} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#1A0E03]" />
        Pulsing
      </span>
    );
  }

  if (online) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium border border-nn-online/35 bg-nn-online/13 text-[#8FC773] ${pad} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-nn-online shadow-[0_0_8px_var(--nn-online)]" />
        Active now
      </span>
    );
  }

  const label = lastSeen ? `Last seen ${formatRelative(lastSeen)}` : 'Offline';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border border-nn-border bg-nn-muted/8 text-nn-muted ${pad} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-nn-muted opacity-50" />
      {label}
    </span>
  );
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
