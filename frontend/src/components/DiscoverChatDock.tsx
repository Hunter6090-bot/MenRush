import { useCallback, useEffect, useRef, useState } from 'react';
import { mapFeedAPI, MapFeedMessage } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { IconClose } from './icons';

const DOCK_STORAGE_KEY = 'menrush_discover_chat_dock';
const MAX_VISIBLE = 6;
const FADE_AFTER_MS = 12 * 60 * 1000; // 12 minutes
const POLL_INTERVAL_MS = 30_000;

export function readDockOpen(): boolean {
  try {
    // Default closed — collapsed toggle never steals map pan/zoom.
    return localStorage.getItem(DOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function msgAge(msg: MapFeedMessage): number {
  return Date.now() - new Date(msg.created_at).getTime();
}

function msgOpacity(msg: MapFeedMessage): number {
  const age = msgAge(msg);
  if (age >= FADE_AFTER_MS) return 0;
  // Fade from 1 → 0.35 over the last 4 minutes
  const fadeStart = FADE_AFTER_MS - 4 * 60 * 1000;
  if (age < fadeStart) return 1;
  return 0.35 + 0.65 * (1 - (age - fadeStart) / (4 * 60 * 1000));
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Sniffies-style live nearby map-feed panel.
 * Messages stack upward, fade with age (~12 min), max 6 visible.
 */
export function DiscoverChatDock({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const socket = useSocket();
  const { user } = useAuthStore();
  const { lat, lng } = useLocationStore();
  const [messages, setMessages] = useState<MapFeedMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userClosedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist open state
  useEffect(() => {
    try {
      localStorage.setItem(DOCK_STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (open) {
      setHasNewMsg(false);
      userClosedRef.current = false;
    }
  }, [open]);

  // Fetch initial feed
  const fetchFeed = useCallback(async () => {
    try {
      const res = await mapFeedAPI.list(lat ?? undefined, lng ?? undefined, 50);
      const fresh = (res.data.messages ?? []).filter((m) => msgAge(m) < FADE_AFTER_MS);
      setMessages(fresh.slice(-MAX_VISIBLE * 3)); // keep buffer
    } catch {
      /* silent — map feed is best-effort */
    }
  }, [lat, lng]);

  useEffect(() => {
    fetchFeed();
    pollRef.current = setInterval(fetchFeed, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchFeed]);

  // Socket live updates
  useEffect(() => {
    if (!socket) return;
    const onFeedMsg = (data: MapFeedMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        const next = [...prev, data].filter((m) => msgAge(m) < FADE_AFTER_MS);
        return next.slice(-MAX_VISIBLE * 3);
      });
      if (!open && !userClosedRef.current) {
        setHasNewMsg(true);
        onOpenChange(true);
      } else if (!open) {
        setHasNewMsg(true);
      }
    };
    socket.on('map:feed:message', onFeedMsg);
    return () => {
      socket.off('map:feed:message', onFeedMsg);
    };
  }, [socket, open, onOpenChange]);

  // Expire old messages on a ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setMessages((prev) => prev.filter((m) => msgAge(m) < FADE_AFTER_MS));
    }, 60_000);
    return () => clearInterval(ticker);
  }, []);

  // Scroll to bottom when expanded + new messages
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleClose = () => {
    userClosedRef.current = true;
    onOpenChange(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      const res = await mapFeedAPI.post({
        message: text,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        display_name: user?.name ?? 'Anonymous',
      });
      // HTTP path: show own post even if socket room join lagged or emit missed self.
      const saved = res.data;
      if (saved?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev;
          const next = [...prev, saved].filter((m) => msgAge(m) < FADE_AFTER_MS);
          return next.slice(-MAX_VISIBLE * 3);
        });
      }
    } catch {
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const visible = messages.slice(-MAX_VISIBLE);

  // Collapsed toggle button
  if (!open) {
    return (
      <button
        type="button"
        data-testid="discover-chat-dock-toggle"
        aria-label="Open map chat"
        title="Map chat"
        onClick={() => onOpenChange(true)}
        className="pointer-events-auto absolute bottom-20 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(196,131,42,0.5)] bg-[rgba(15,10,6,0.82)] text-[#E0A14A] shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-md transition-transform active:scale-95"
      >
        <ChatBubbleIcon className="h-5 w-5" />
        {hasNewMsg && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#C4832A] ring-2 ring-[rgba(15,10,6,0.9)]" />
        )}
      </button>
    );
  }

  return (
    <div
      data-testid="discover-chat-dock"
      className="pointer-events-auto absolute bottom-4 right-3 z-30 flex w-[min(100%-1.5rem,340px)] flex-col overflow-hidden rounded-2xl border border-[rgba(196,131,42,0.35)] shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      style={{
        background: 'rgba(13,10,6,0.82)',
        maxHeight: '56vh',
      }}
      role="dialog"
      aria-label="Nearby map chat"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[rgba(196,131,42,0.2)] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#C4832A] shadow-[0_0_6px_#C4832A]" />
        <p className="flex-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#E0A14A]">
          Nearby · Live
        </p>
        <button
          type="button"
          aria-label="Close map chat"
          onClick={handleClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#A89070] transition-colors hover:text-[#E0A14A]"
        >
          <IconClose size={14} />
        </button>
      </div>

      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
        {visible.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-[#6B5035]">
            No nearby messages yet — say something!
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visible.map((msg) => {
              const opacity = msgOpacity(msg);
              const isMine = msg.display_name === user?.name;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
                  style={{ opacity }}
                >
                  {/* Avatar initial */}
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      background: 'rgba(196,131,42,0.2)',
                      border: '1px solid rgba(196,131,42,0.3)',
                      color: '#C4832A',
                    }}
                  >
                    {(msg.display_name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className={`flex max-w-[78%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="mb-0.5 text-[9px] font-semibold text-[#A89070]">
                      {isMine ? 'You' : msg.display_name}
                      {msg.distance_label ? ` · ${msg.distance_label}` : ''}
                    </span>
                    <div
                      className="rounded-2xl px-3 py-1.5 text-[12px] leading-snug"
                      style={
                        isMine
                          ? {
                              background: 'linear-gradient(135deg,#C4832A,#A45E18)',
                              color: '#FFF5E6',
                              borderRadius: '14px 14px 4px 14px',
                            }
                          : {
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(196,131,42,0.18)',
                              color: '#F0DFC0',
                              borderRadius: '14px 14px 14px 4px',
                            }
                      }
                    >
                      {msg.message}
                    </div>
                    <span className="mt-0.5 text-[9px] text-[#4A3520]">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="shrink-0 border-t border-[rgba(196,131,42,0.18)] px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Say something nearby…"
            maxLength={200}
            className="flex-1 rounded-full bg-[rgba(255,255,255,0.06)] px-3.5 py-2 text-[12px] text-[#F0DFC0] placeholder-[#4A3520] outline-none focus:ring-1 focus:ring-[rgba(196,131,42,0.4)]"
            style={{ border: '1px solid rgba(196,131,42,0.22)' }}
          />
          <button
            type="button"
            disabled={!input.trim() || sending}
            onClick={() => void handleSend()}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#C4832A,#A45E18)' }}
          >
            <SendIcon className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
