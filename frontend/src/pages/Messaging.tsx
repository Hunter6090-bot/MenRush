import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { messagesAPI, usersAPI } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore, useCallStore } from '../hooks/store';
import { useWebRTC } from '../hooks/useWebRTC';
import { VideoCallModal } from '../components/VideoCallModal';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { PulseRing } from '../components/PulseRing';
import { FEATURES } from '../lib/featureFlags';

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function isSameDay(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ── Main component ───────────────────────────────────────────────────────────

export const Messages = () => {
  const { otherId } = useParams<{ otherId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const socket = useSocket();
  const user = useAuthStore((s) => s.user);
  const { setCalling } = useCallStore();
  const { startCall } = useWebRTC();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');

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
    inputValueRef.current = e.target.value;
    setInput(e.target.value);
    emitTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault?.();
    const current = (inputValueRef.current ?? input).trim();
    if (!current || !otherId || !user) return;

    emitTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);

    inputValueRef.current = '';
    setInput('');
    setSending(true);
    inputRef.current?.focus();

    try {
      const res = await messagesAPI.sendMessage(otherId, current);
      const saved: Message = res.data;
      setMessages((prev) => [...prev, saved]);
    } catch {
      inputValueRef.current = current;
      setInput(current);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0D0A06' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-4 border-b"
        style={{
          height: '64px',
          background: 'rgba(13,10,6,0.94)',
          borderColor: '#3D2B0E',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 20,
        }}
      >
        {/* Back */}
        <button
          onClick={() => navigate('/conversations')}
          aria-label="Go back"
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
          style={{ color: '#A89070' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F0E0C0')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#A89070')}
        >
          <BackIcon className="w-5 h-5" />
        </button>

        {/* Avatar + name block — centered, tappable to open profile */}
        <button
          type="button"
          onClick={() => otherId && navigate(`/profile/${otherId}`)}
          aria-label={otherUser ? `Open ${otherUser.name}'s profile` : 'Open profile'}
          className="flex-1 flex items-center gap-3 min-w-0 text-left rounded-xl px-1 py-1 -mx-1 hover:bg-[#3D2B0E]/40 active:scale-[0.99] transition-all"
        >
          {otherUser ? (
            <>
              <UserAvatar
                name={otherUser.name}
                photoUrl={otherUser.photo_url}
                online={otherUser.online}
                size="sm"
              />
              <div className="min-w-0">
                <p
                  className="font-semibold text-sm leading-tight truncate"
                  style={{ color: '#F0E0C0', letterSpacing: '0.01em' }}
                >
                  {otherUser.name}
                </p>
                <StatusBadge
                  online={!!otherUser.online}
                  lastSeen={otherUser.last_seen}
                  className="mt-0.5"
                />
              </div>
            </>
          ) : (
            <p className="font-semibold text-sm" style={{ color: '#F0E0C0' }}>
              Conversation
            </p>
          )}
        </button>

        {FEATURES.videoCalls && (
          <>
            {/* Video call button */}
            <button
              onClick={() => {
                  if (otherId && otherUser?.name) {
                    setCalling(otherId, otherUser.name);
                    startCall(otherId, otherUser.name);
                  }
                }}
              aria-label="Start video call"
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #8B4513)',
                boxShadow: '0 2px 12px rgba(196,131,42,0.35)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 4px 20px rgba(196,131,42,0.55)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 2px 12px rgba(196,131,42,0.35)';
              }}
            >
              <VideoIcon className="w-4 h-4 text-white" />
            </button>
          </>
        )}
      </header>

      {/* ── Messages area ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollbarWidth: 'thin' }}
      >
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full select-none">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: '#1E1508', border: '1px solid #3D2B0E' }}
            >
              <BubbleIcon className="w-8 h-8" style={{ color: '#C4832A', opacity: 0.5 }} />
            </div>
            <p className="font-medium text-sm" style={{ color: '#A89070' }}>
              No messages yet
            </p>
            <p className="text-xs mt-1" style={{ color: '#6B5035' }}>
              Say hello and break the ice
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id;
          const prevMsg = messages[i - 1];
          const nextMsg = messages[i + 1];
          const showDateSep = !isSameDay(prevMsg?.created_at, msg.created_at);
          const showTail = !nextMsg || nextMsg.sender_id !== msg.sender_id;
          const isGrouped = prevMsg && prevMsg.sender_id === msg.sender_id && !showDateSep;

          return (
            <React.Fragment key={msg.id ?? i}>
              {/* Date separator */}
              {showDateSep && (
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px" style={{ background: '#3D2B0E' }} />
                  <span
                    className="text-[10px] font-semibold px-3 py-1 rounded-full"
                    style={{
                      background: '#1E1508',
                      border: '1px solid #3D2B0E',
                      color: '#A89070',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {formatDateLabel(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: '#3D2B0E' }} />
                </div>
              )}

              {/* Message row */}
              <div
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
                  isGrouped ? 'mt-0.5' : 'mt-3'
                }`}
              >
                {/* Received: avatar placeholder for spacing */}
                {!isMine && (
                  <div className="w-7 flex-shrink-0 mr-2 flex items-end mb-1">
                    {showTail && (
                      otherUser?.photo_url ? (
                        <div
                          className="w-7 h-7 rounded-full overflow-hidden"
                          style={{ border: '1px solid #3D2B0E', flexShrink: 0 }}
                        >
                          <img
                            src={otherUser.photo_url}
                            alt={otherUser.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <SilhouetteAvatar size={28} variant="chat" />
                      )
                    )}
                  </div>
                )}

                <div
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[72%]`}
                >
                  <div
                    className="relative px-4 py-2.5 text-sm leading-relaxed"
                    style={
                      isMine
                        ? {
                            background: 'linear-gradient(135deg, #C4832A, #8B4513)',
                            color: '#FFF5E6',
                            borderRadius: showTail
                              ? '18px 18px 4px 18px'
                              : '18px 18px 18px 18px',
                            boxShadow: '0 2px 12px rgba(196,131,42,0.28)',
                          }
                        : {
                            background: '#1E1508',
                            border: '1px solid #3D2B0E',
                            color: '#F0E0C0',
                            borderRadius: showTail
                              ? '18px 18px 18px 4px'
                              : '18px 18px 18px 18px',
                          }
                    }
                  >
                    {msg.message}
                  </div>
                  {/* Timestamp */}
                  {showTail && (
                    <span
                      className="text-[10px] mt-1 px-1"
                      style={{ color: '#6B5035' }}
                    >
                      {formatTime(msg.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex justify-start mt-3">
            <div className="w-7 flex-shrink-0 mr-2" />
            <div
              className="px-4 py-3 rounded-[18px] rounded-bl-[4px] flex items-center gap-1.5"
              style={{
                background: '#1E1508',
                border: '1px solid #3D2B0E',
              }}
            >
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-t px-4 py-3"
        style={{
          borderColor: '#3D2B0E',
          background: 'rgba(13,10,6,0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Text input */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              autoComplete="off"
              className="w-full text-sm px-5 py-3 rounded-full focus:outline-none transition-all duration-200"
              style={{
                background: '#1E1508',
                border: '1px solid #3D2B0E',
                color: '#F0E0C0',
                caretColor: '#C4832A',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1px solid rgba(196,131,42,0.5)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,131,42,0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid #3D2B0E';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #C4832A, #8B4513)',
              boxShadow: input.trim() ? '0 2px 12px rgba(196,131,42,0.4)' : 'none',
            }}
          >
            {sending ? (
              <PulseRing size={16} label="Sending" />
            ) : (
              <SendIcon className="w-4 h-4 text-white" />
            )}
          </button>
        </form>
      </div>

      {FEATURES.videoCalls && (
        <>
          {/* ── Video call modal ───────────────────────────────────────────── */}
          <VideoCallModal />
        </>
      )}
    </div>
  );
};

// ── SVG Icons ────────────────────────────────────────────────────────────────

const BackIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const VideoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z"
    />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const BubbleIcon = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    className={className}
    style={style}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);
