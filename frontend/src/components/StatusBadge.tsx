import React from 'react';

interface StatusBadgeProps {
  online: boolean;
  lastSeen?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ online, lastSeen, className = '' }) => {
  const label = online ? 'Online' : lastSeen ? `Last seen ${formatRelative(lastSeen)}` : 'Offline';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
        online
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
          : 'bg-white/5 text-[#F2F4F8]/40 border-white/10'
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          online ? 'bg-emerald-400' : 'bg-white/20'
        }`}
      />
      {online ? 'Online' : 'Offline'}
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
