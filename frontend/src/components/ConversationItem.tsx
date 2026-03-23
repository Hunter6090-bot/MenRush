import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAvatar } from './UserAvatar';
import { NotificationDot } from './NotificationDot';

interface ConversationItemProps {
  userId: string;
  name: string;
  photoUrl?: string;
  online?: boolean;
  lastMessageTime?: string;
  lastMessage?: string;
  unreadCount?: number;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  userId,
  name,
  photoUrl,
  online,
  lastMessageTime,
  lastMessage,
  unreadCount,
}) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/messages/${userId}`)}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#1E1508] border border-[#3D2B0E] hover:border-[#C4832A]/30 hover:bg-[#2A1C0A] transition-all duration-200 text-left group"
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
        <p className={`text-xs mt-0.5 truncate ${unreadCount ? 'text-[#F0E0C0]/70 font-medium' : 'text-[#A89070]'}`}>
          {lastMessage ?? (online ? 'Active now' : 'Say hello!')}
        </p>
      </div>

      <ChevronIcon className="w-4 h-4 text-[#A89070]/40 group-hover:text-[#C4832A]/60 transition-colors flex-shrink-0" />
    </button>
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
