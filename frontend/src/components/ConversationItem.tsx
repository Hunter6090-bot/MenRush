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
}) => {
  const navigate = useNavigate();
  const isMissedCall = lastMessage === MISSED_CALL_PREVIEW;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(`/messages/${userId}`)}
        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#1E1508] border border-[#3D2B0E] hover:border-[#C4832A]/30 hover:bg-[#2A1C0A] transition-all duration-200 text-left group"
      >
      <div className="relative">
        <UserAvatar name={name} photoUrl={photoUrl} online={online} size="md" />
        {unreadCount ? <NotificationDot count={unreadCount} /> : null}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`font-semibold text-sm truncate ${unreadCount ? 'text-[#F0E0C0]' : 'text-[#F0E0C0]/80'}`}>
            {name}
          </p>
          {lastMessageTime && (
            <span className="text-[10px] text-[#A89070] flex-shrink-0 ml-2">
              {formatRelative(lastMessageTime)}
            </span>
          )}
        </div>
        <p
          className={`text-xs mt-0.5 truncate flex items-center gap-1 ${
            isMissedCall
              ? 'text-[#F87171] font-semibold'
              : unreadCount
                ? 'text-[#F0E0C0]/70 font-medium'
                : 'text-[#A89070]'
          }`}
        >
          {isMissedCall && <MissedCallIcon size={12} className="shrink-0" />}
          {lastMessage ?? (online ? 'Active now' : 'Say hello!')}
        </p>
      </div>

      <ChevronIcon className="w-4 h-4 text-[#A89070]/40 group-hover:text-[#C4832A]/60 transition-colors flex-shrink-0" />
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
