import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { messagesAPI, usersAPI } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../hooks/store';
import { MessageBubble } from '../components/MessageBubble';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface Message {
  id?: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at?: string;
}

interface OtherUser {
  name: string;
  photo_url?: string;
  online?: boolean;
  last_seen?: string;
}

export const Messages = () => {
  const { otherId } = useParams<{ otherId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const socket = useSocket();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!otherId) return;
    messagesAPI.getConversation(otherId).then((r) => setMessages(r.data)).catch(() => {});
    usersAPI.getProfile(otherId).then((r) => setOtherUser(r.data)).catch(() => {});
  }, [otherId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  useEffect(() => {
    if (!socket || !otherId) return;

    const onMessage = (data: Message) => {
      if (data.sender_id === otherId || data.receiver_id === otherId) {
        setMessages((prev) => [...prev, data]);
      }
    };
    const onTyping = ({ typing }: { typing: boolean }) => setIsOtherTyping(typing);

    socket.on('message', onMessage);
    socket.on('typing', onTyping);

    return () => {
      socket.off('message', onMessage);
      socket.off('typing', onTyping);
    };
  }, [socket, otherId]);

  const emitTyping = (typing: boolean) => {
    socket?.emit('typing', { receiver_id: otherId, typing });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    emitTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !otherId || !user) return;

    emitTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);

    const text = input.trim();
    setInput('');
    setSending(true);

    try {
      const res = await messagesAPI.sendMessage(otherId, text);
      const saved: Message = res.data;
      setMessages((prev) => [...prev, saved]);
    } catch {
      // restore input on failure
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#151821] flex flex-col">
      {/* ── Header ── */}
      <div className="flex-shrink-0 h-14 flex items-center gap-3 px-4 bg-[#151821]/92 backdrop-blur-xl border-b border-white/[0.06] z-10">
        <button
          onClick={() => navigate('/conversations')}
          className="p-1.5 rounded-xl text-[#F2F4F8]/40 hover:text-[#F2F4F8] hover:bg-white/5 transition-all"
        >
          <BackIcon className="w-5 h-5" />
        </button>

        {otherUser ? (
          <>
            <UserAvatar name={otherUser.name} photoUrl={otherUser.photo_url} online={otherUser.online} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#F2F4F8] text-sm leading-tight truncate">{otherUser.name}</p>
              <StatusBadge online={!!otherUser.online} lastSeen={otherUser.last_seen} className="mt-0.5 text-[9px]" />
            </div>
          </>
        ) : (
          <p className="font-semibold text-[#F2F4F8]">Conversation</p>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <BubbleIcon className="w-10 h-10 text-[#F2F4F8]/20 mb-3" />
            <p className="text-[#F2F4F8]/40 text-sm">No messages yet — say hello!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const nextMsg = messages[i + 1];
          const showTail = !nextMsg || nextMsg.sender_id !== msg.sender_id;
          return (
            <MessageBubble
              key={msg.id ?? i}
              message={msg.message}
              timestamp={msg.created_at}
              isMine={msg.sender_id === user?.id}
              showTail={showTail}
            />
          );
        })}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-[#21252D] border border-white/[0.07] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <span className="typing-dot w-2 h-2 rounded-full bg-[#F2F4F8]/40" />
              <span className="typing-dot w-2 h-2 rounded-full bg-[#F2F4F8]/40" />
              <span className="typing-dot w-2 h-2 rounded-full bg-[#F2F4F8]/40" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#151821]/92 backdrop-blur-xl px-4 py-3 safe-area-inset-bottom">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="flex-1 bg-[#222632] border border-white/[0.08] text-[#F2F4F8] placeholder:text-[#F2F4F8]/25 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl bg-[#4F8CFF] hover:bg-[#3a6fe0] disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all duration-200 hover:shadow-glow-blue active:scale-95 flex-shrink-0"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <SendIcon className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const BackIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const BubbleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
