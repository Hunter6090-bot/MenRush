import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { messagesAPI, usersAPI, MediaKind, MessageDTO } from '../api/client';
import { trackEventOnce } from '../observability/analytics';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore, useCallStore } from '../hooks/store';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { PulseRing } from '../components/PulseRing';
import { getPhotoUrl } from '../components/UserAvatar';
import { FEATURES } from '../lib/featureFlags';

/** Local message shape — matches MessageDTO but tolerates partial server payloads. */
interface Message extends Partial<MessageDTO> {
  id?: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at?: string;
  media_type?: MediaKind | null;
  media_url?: string | null;
  audio_duration_ms?: number | null;
  is_disappearing?: boolean;
  expires_at?: string | null;
  viewed_at?: string | null;
  expired?: boolean;
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
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  // Ticks once a second so disappearing countdowns and burned states update.
  const [, setBurnTick] = useState(0);
  const socket = useSocket();
  const user = useAuthStore((s) => s.user);
  const { setCalling } = useCallStore();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const onViewed = (data: { id: string; viewed_at: string; expires_at: string | null }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, viewed_at: data.viewed_at, expires_at: data.expires_at } : m,
        ),
      );
    };

    socket.on('message', onMessage);
    socket.on('typing', onTyping);
    socket.on('message:viewed', onViewed);

    return () => {
      socket.off('message', onMessage);
      socket.off('typing', onTyping);
      socket.off('message:viewed', onViewed);
    };
  }, [socket, otherId]);

  // Drive disappearing-message countdowns. 1Hz is enough — the burn window
  // is 10s, so users see the second-by-second tick clearly.
  useEffect(() => {
    const id = window.setInterval(() => setBurnTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-dismiss media error toasts so they don't stick around.
  useEffect(() => {
    if (!mediaError) return;
    const id = window.setTimeout(() => setMediaError(''), 4000);
    return () => window.clearTimeout(id);
  }, [mediaError]);

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

  // ── Media: image attach (disappearing by default) ─────────────────────
  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !otherId) return;
    if (!file.type.startsWith('image/')) {
      setMediaError('Only images can be attached.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMediaError('Image is too large (max 12 MB).');
      return;
    }
    setMediaError('');
    setUploadingMedia(true);
    try {
      const res = await messagesAPI.sendMedia(otherId, file, { kind: 'image', disappearing: true });
      setMessages((prev) => [...prev, res.data]);
    } catch (err: any) {
      setMediaError(err?.response?.data?.error || 'Failed to send photo');
    } finally {
      setUploadingMedia(false);
    }
  };

  // ── Media: voice notes (tap to start, tap again to stop) ──────────────
  const handleStartRecording = useCallback(async () => {
    if (recording || uploadingMedia || !otherId) return;
    setMediaError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const duration = Date.now() - recordStartRef.current;
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        // Tear down the mic stream so the OS indicator goes away immediately.
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setRecording(false);
        setRecordSeconds(0);
        // Throw away accidental sub-second taps.
        if (duration < 800 || blob.size < 1000) return;
        setUploadingMedia(true);
        try {
          const res = await messagesAPI.sendMedia(otherId!, blob, {
            kind: 'audio',
            durationMs: duration,
          });
          setMessages((prev) => [...prev, res.data]);
        } catch (err: any) {
          setMediaError(err?.response?.data?.error || 'Failed to send voice note');
        } finally {
          setUploadingMedia(false);
        }
      };
      recordStartRef.current = Date.now();
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(
        () => setRecordSeconds((s) => Math.min(180, s + 1)),
        1000,
      );
      // Hard cap at 3 minutes.
      window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 180_000);
    } catch (err: any) {
      setMediaError('Microphone access denied.');
      setRecording(false);
    }
  }, [recording, uploadingMedia, otherId]);

  const handleStopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') mr.stop();
  }, []);

  // ── Mark a disappearing message as viewed (recipient side) ────────────
  const handleMarkViewed = async (id: string) => {
    try {
      const res = await messagesAPI.markViewed(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...res.data } : m)));
    } catch {
      // Server already replies with the canonical row; silently ignore conflicts.
    }
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
      trackEventOnce(
        'first_message_success',
        { kind: 'text', surface: 'direct_message' },
        'first_message_success',
      );
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
                  {msg.media_type === 'image' ? (
                    <ImageBubble
                      msg={msg}
                      isMine={isMine}
                      showTail={showTail}
                      onReveal={handleMarkViewed}
                    />
                  ) : msg.media_type === 'audio' ? (
                    <AudioBubble msg={msg} isMine={isMine} showTail={showTail} />
                  ) : (
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
                  )}
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
        {mediaError && (
          <div
            className="mb-2 text-[11px] px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(196,131,42,0.12)',
              border: '1px solid rgba(196,131,42,0.35)',
              color: '#F0E0C0',
            }}
          >
            {mediaError}
          </div>
        )}

        {/* Hidden file input — triggered by the attach button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Attach disappearing photo"
          className="hidden"
          onChange={handleFileChange}
        />

        {recording ? (
          // Recording-only bar — Stop sends, Cancel discards.
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                recordChunksRef.current = []; // discard
                handleStopRecording();
              }}
              aria-label="Cancel recording"
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: '#1E1508', border: '1px solid #3D2B0E', color: '#A89070' }}
            >
              <CloseIcon className="w-4 h-4" />
            </button>
            <div
              className="flex-1 flex items-center gap-2 px-4 py-3 rounded-full"
              style={{ background: '#1E1508', border: '1px solid rgba(196,131,42,0.4)' }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: '#E5484D', boxShadow: '0 0 8px #E5484D' }}
              />
              <span className="text-xs" style={{ color: '#F0E0C0' }}>
                Recording… {formatDuration(recordSeconds * 1000)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleStopRecording}
              aria-label="Send voice note"
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #8B4513)',
                boxShadow: '0 2px 12px rgba(196,131,42,0.4)',
              }}
            >
              <SendIcon className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Attach image */}
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={uploadingMedia}
              aria-label="Send disappearing photo"
              title="Send disappearing photo"
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center active:scale-95 disabled:opacity-40"
              style={{ background: '#1E1508', border: '1px solid #3D2B0E', color: '#C4832A' }}
            >
              <CameraIcon className="w-4 h-4" />
            </button>

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

            {/* Voice note OR Send — switch based on whether there's text */}
            {input.trim() ? (
              <button
                type="submit"
                disabled={!input.trim() || sending}
                aria-label="Send message"
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #C4832A, #8B4513)',
                  boxShadow: '0 2px 12px rgba(196,131,42,0.4)',
                }}
              >
                {sending ? (
                  <PulseRing size={16} label="Sending" />
                ) : (
                  <SendIcon className="w-4 h-4 text-white" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={uploadingMedia}
                aria-label="Record voice note"
                title="Record voice note"
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center active:scale-95 disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #C4832A, #8B4513)',
                  boxShadow: '0 2px 12px rgba(196,131,42,0.4)',
                }}
              >
                <MicIcon className="w-4 h-4 text-white" />
              </button>
            )}
          </form>
        )}
      </div>

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

const CameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h2l1.5-2h7L17 7h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <circle cx="12" cy="13" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12a7 7 0 0014 0M12 19v3" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);

const FlameIcon = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg className={className} style={style} fill="currentColor" viewBox="0 0 24 24">
    <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0 0 16 0c0-4.16-2-7.86-6.5-13.33z" />
  </svg>
);

function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '0:00';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── ImageBubble ──────────────────────────────────────────────────────────────
// Renders disappearing and persistent image messages. Disappearing-not-yet-viewed
// images on the recipient side show a locked card; tapping reveals the photo
// and starts the server-tracked 10s burn.

interface ImageBubbleProps {
  msg: Message;
  isMine: boolean;
  showTail: boolean;
  onReveal: (id: string) => void;
}

const ImageBubble: React.FC<ImageBubbleProps> = ({ msg, isMine, showTail, onReveal }) => {
  const radius = showTail
    ? isMine
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px'
    : '18px';

  // Compute live "expired" — server expired flag OR client-side derived.
  const expiresMs = msg.expires_at ? Date.parse(msg.expires_at) : null;
  const isExpired = !!msg.expired || (expiresMs != null && expiresMs <= Date.now());
  const secondsLeft = expiresMs ? Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000)) : null;
  const url = getPhotoUrl(msg.media_url || undefined);

  // Burned tombstone — both sides see this once the window has elapsed.
  if (isExpired || !url) {
    return (
      <div
        className="px-4 py-3 flex items-center gap-2 text-xs"
        style={{
          background: '#1E1508',
          border: '1px solid #3D2B0E',
          color: '#A89070',
          borderRadius: radius,
          minWidth: 180,
        }}
      >
        <FlameIcon className="w-4 h-4" />
        <span>Photo burned</span>
      </div>
    );
  }

  // Recipient + disappearing + not yet opened → locked teaser.
  const lockedForRecipient = !isMine && msg.is_disappearing && !msg.viewed_at;
  if (lockedForRecipient) {
    return (
      <button
        type="button"
        onClick={() => msg.id && onReveal(msg.id)}
        className="relative overflow-hidden flex items-center justify-center active:scale-[0.98] transition-transform"
        style={{
          width: 220,
          height: 220,
          background: 'linear-gradient(135deg, #1E1508 0%, #0D0A06 100%)',
          border: '1px solid #3D2B0E',
          borderRadius: radius,
        }}
        aria-label="Tap to view disappearing photo"
      >
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(196,131,42,0.15)', border: '1px solid rgba(196,131,42,0.4)' }}
          >
            <FlameIcon className="w-5 h-5" style={{ color: '#C4832A' }} />
          </div>
          <p className="text-xs font-semibold" style={{ color: '#F0E0C0' }}>
            Tap to view
          </p>
          <p className="text-[10px]" style={{ color: '#A89070' }}>
            Burns 10s after you open it
          </p>
        </div>
      </button>
    );
  }

  // Photo visible. If disappearing + already viewed, show a countdown overlay.
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: '#1E1508',
        border: isMine ? 'none' : '1px solid #3D2B0E',
        borderRadius: radius,
        boxShadow: isMine ? '0 2px 12px rgba(196,131,42,0.28)' : 'none',
      }}
    >
      <img
        src={url}
        alt={msg.message || 'photo'}
        className="block max-w-[260px] max-h-[340px] object-cover"
      />
      {msg.is_disappearing && (
        <div
          className="absolute top-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(13,10,6,0.75)',
            border: '1px solid rgba(196,131,42,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <span className="flex items-center gap-1 text-[10px]" style={{ color: '#F0E0C0' }}>
            <FlameIcon className="w-3 h-3" style={{ color: '#C4832A' }} />
            <span>Disappearing</span>
          </span>
          {secondsLeft != null ? (
            <span className="text-[10px] tabular-nums" style={{ color: '#F0E0C0' }}>
              {secondsLeft}s
            </span>
          ) : isMine ? (
            <span className="text-[10px]" style={{ color: '#A89070' }}>
              Awaiting view
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};

// ── AudioBubble ──────────────────────────────────────────────────────────────
// Inline voice-note player with copper play/pause and duration tag.

interface AudioBubbleProps {
  msg: Message;
  isMine: boolean;
  showTail: boolean;
}

const AudioBubble: React.FC<AudioBubbleProps> = ({ msg, isMine, showTail }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const url = getPhotoUrl(msg.media_url || undefined);
  const duration = msg.audio_duration_ms ?? 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime * 1000);
    const onEnded = () => {
      setPlaying(false);
      setPosition(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [url]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !url) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const radius = showTail
    ? isMine
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px'
    : '18px';

  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
      style={{
        background: isMine ? 'linear-gradient(135deg, #C4832A, #8B4513)' : '#1E1508',
        border: isMine ? 'none' : '1px solid #3D2B0E',
        color: isMine ? '#FFF5E6' : '#F0E0C0',
        borderRadius: radius,
        boxShadow: isMine ? '0 2px 12px rgba(196,131,42,0.28)' : 'none',
        minWidth: 200,
      }}
    >
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
        style={{
          background: isMine ? 'rgba(13,10,6,0.35)' : 'rgba(196,131,42,0.18)',
          color: isMine ? '#FFF5E6' : '#C4832A',
        }}
      >
        {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: isMine ? 'rgba(13,10,6,0.35)' : 'rgba(196,131,42,0.18)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${progressPct}%`,
              background: isMine ? '#FFF5E6' : '#C4832A',
              transition: 'width 120ms linear',
            }}
          />
        </div>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: isMine ? 'rgba(255,245,230,0.75)' : '#A89070' }}
        >
          {formatDuration(playing ? position : duration)}
        </span>
      </div>
      {url && <audio ref={audioRef} src={url} preload="metadata" />}
    </div>
  );
};
