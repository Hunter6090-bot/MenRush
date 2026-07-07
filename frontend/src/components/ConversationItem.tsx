import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAvatar } from './UserAvatar';
import { NotificationDot } from './NotificationDot';
import { MissedCallIcon } from './MissedCallIcon';
import { ChatSafetyMenu } from './ChatSafetyMenu';
import { MISSED_CALL_PREVIEW } from '../lib/missedCall';

interface ConversationItemProps {
  userId: string;
  name: string;
  photoUrl?: string;
  online?: boolean;
  lastMessageTime?: string;
  lastMessage?: string;
  unreadCount?: number;
  onBlocked?: () => void;
  isActive?: boolean;
  variant?: 'default' | 'sidebar';
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  userId,
  name,
  photoUrl,
  online,
  lastMessageTime,
  lastMessage,
  unreadCount,
  onBlocked,
  isActive = false,
  variant = 'default',
}) => {
  const navigate = useNavigate();
  const isMissedCall = lastMessage === MISSED_CALL_PREVIEW;
  const isSidebar = variant === 'sidebar';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(`/messages/${userId}`)}
        className={`group flex min-w-0 flex-1 items-center gap-3 text-left transition-all duration-200 ${
          isSidebar
            ? `rounded-[14px] px-3 py-3 ${
                isActive ? 'bg-nn-card' : 'hover:bg-nn-card/60'
              }`
            : 'rounded-2xl border border-nn-border bg-nn-card px-4 py-3.5 hover:border-nn-copper/30 hover:bg-nn-elevated'
        }`}
      >
      <div className="relative shrink-0">
        <UserAvatar
          name={name}
          photoUrl={photoUrl}
          online={online}
          size="md"
          className={isSidebar ? '!w-[46px] !h-[46px] ring-2 ring-[rgba(196,131,42,0.35)]' : undefined}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-nn-text">{name}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {lastMessageTime ? (
              <span className="text-[11px] text-nn-faint">{formatRelative(lastMessageTime)}</span>
            ) : null}
            {unreadCount ? (
              <span className="h-[9px] w-[9px] rounded-full bg-nn-copper" aria-label="Unread" />
            ) : null}
          </div>
        </div>
        <p
          className={`mt-0.5 truncate text-[13px] flex items-center gap-1 ${
            isMissedCall
              ? 'font-semibold text-nn-danger-light'
              : unreadCount
                ? 'font-medium text-nn-muted'
                : 'text-nn-muted'
          }`}
        >
          {isMissedCall && <MissedCallIcon size={12} className="shrink-0" />}
          {lastMessage ?? (online ? 'Active now' : 'Tap to open chat')}
        </p>
      </div>

      <ChevronIcon
        className={`h-4 w-4 flex-shrink-0 transition-colors ${
          isSidebar
            ? isActive
              ? 'text-[var(--copper)]/70'
              : 'text-[#A89070]/30 group-hover:text-[#C4832A]/50'
            : 'text-[#A89070]/40 group-hover:text-[#C4832A]/60'
        }`}
      />
      </button>

      <ChatSafetyMenu peerId={userId} peerName={name} onBlocked={onBlocked} />
    </div>
  );
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
