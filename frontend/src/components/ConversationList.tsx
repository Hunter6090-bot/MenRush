import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagesAPI } from '../api/client';
import { ConversationItem } from './ConversationItem';
import { CreateGroupModal } from './CreateGroupModal';
import { FEATURES } from '../lib/featureFlags';
import { useUnreadStore } from '../hooks/store';
import { useSocket } from '../hooks/useSocket';

export interface ConversationRow {
  other_user_id: string;
  other_user_name: string;
  last_message_time: string;
  last_message?: string;
  photo_url?: string;
  online?: boolean;
  unread_count?: number;
}

interface ConversationListProps {
  activeUserId?: string;
  variant?: 'mobile' | 'sidebar';
  showHeader?: boolean;
  className?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  activeUserId,
  variant = 'mobile',
  showHeader = true,
  className = '',
}) => {
  const [convs, setConvs] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupOpen, setGroupOpen] = useState(false);
  const navigate = useNavigate();
  const unreadBySender = useUnreadStore((s) => s.unreadBySender);
  const socket = useSocket();
  const isSidebar = variant === 'sidebar';

  const fetchConversations = useCallback(() => {
    messagesAPI
      .getConversations()
      .then((r) => setConvs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = () => fetchConversations();
    socket.on('message', onMessage);
    return () => {
      socket.off('message', onMessage);
    };
  }, [socket, fetchConversations]);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {showHeader && (
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-default)] ${
            isSidebar ? 'px-4 py-4' : 'mb-5'
          }`}
        >
          {!isSidebar ? (
            <h2 className="text-xl font-bold text-[#F0E0C0]">Messages</h2>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
                Inbox
              </p>
              <p className="text-sm font-semibold text-[var(--cream)]">Direct messages</p>
            </div>
          )}
          {FEATURES.chatRooms && (
            <button
              type="button"
              onClick={() => setGroupOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#C4832A]/35 bg-[#C4832A]/15 px-3 py-2 text-xs font-semibold text-[#F0E0C0] transition-all hover:bg-[#C4832A]/25 active:scale-95"
            >
              <GroupPlusIcon className="h-4 w-4" />
              {isSidebar ? 'Group' : 'New group'}
            </button>
          )}
        </div>
      )}

      <div className={`min-h-0 flex-1 overflow-y-auto ${isSidebar ? 'px-2 py-3' : ''}`}>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`animate-pulse rounded-2xl border border-[#3D2B0E] bg-[#1E1508] ${
                  isSidebar ? 'h-16' : 'h-[70px]'
                }`}
              />
            ))}
          </div>
        ) : convs.length === 0 ? (
          <div className={`text-center animate-fade-in ${isSidebar ? 'px-4 py-16' : 'py-20'}`}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#3D2B0E] bg-[#1E1508]">
              <ChatIcon className="h-8 w-8 text-[#C4832A]/50" />
            </div>
            <p className="mb-1 font-medium text-[#F0E0C0]/60">No conversations yet</p>
            <p className="mb-5 text-sm text-[#A89070]">Find someone nearby and say hi</p>
            <button
              onClick={() => navigate('/discover')}
              className="rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:from-[#D4943B] hover:to-[#9B5523] hover:shadow-glow-blue"
            >
              Discover People
            </button>
          </div>
        ) : (
          <div className={`animate-fade-in ${isSidebar ? 'space-y-1' : 'space-y-2'}`}>
            {convs.map((c) => (
              <ConversationItem
                key={c.other_user_id}
                userId={c.other_user_id}
                name={c.other_user_name}
                photoUrl={c.photo_url}
                online={c.online}
                lastMessageTime={c.last_message_time}
                lastMessage={c.last_message}
                unreadCount={c.unread_count ?? unreadBySender[c.other_user_id] ?? 0}
                onBlocked={fetchConversations}
                isActive={activeUserId === c.other_user_id}
                variant={isSidebar ? 'sidebar' : 'default'}
              />
            ))}
          </div>
        )}
      </div>

      {FEATURES.chatRooms && (
        <CreateGroupModal open={groupOpen} onClose={() => setGroupOpen(false)} />
      )}
    </div>
  );
};

const GroupPlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
