import { useCallback, useEffect, useRef, useState } from 'react';
import { mapFeedAPI, MapFeedMessage } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { IconClose } from './icons';
import { FadedBrandFace } from './FadedBrandFace';
import { OwnPostMenu } from './OwnPostMenu';
import {
  CONFIRM_BODY,
  CONFIRM_BOX,
  CONFIRM_CANCEL_BTN,
  CONFIRM_DANGER_BTN,
  CONFIRM_TITLE,
} from '../lib/confirmStyles';

const DOCK_STORAGE_KEY = 'menrush_discover_chat_dock';
const MAX_VISIBLE = 6;
const FADE_AFTER_MS = 12 * 60 * 1000; // 12 minutes
const POLL_INTERVAL_MS = 30_000;

export function readDockOpen(): boolean {
  try {
    // Default closed: collapsed toggle never steals map pan/zoom.
    return localStorage.getItem(DOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function msgAge(msg: MapFeedMessage): number {
  return Date.now() - new Date(msg.created_at).getTime();
}

/**
 * Lowest opacity an ageing message fades to before it drops off. Kept high so the
 * faded text still meets WCAG AA (4.5:1) in light and dark: see
 * DiscoverChatDock.contrast.test.tsx.
 */
export const DOCK_MIN_OPACITY = 0.9;

function msgOpacity(msg: MapFeedMessage): number {
  const age = msgAge(msg);
  if (age >= FADE_AFTER_MS) return 0;
  // Fade gently from 1 to DOCK_MIN_OPACITY over the last 4 minutes.
  const fadeStart = FADE_AFTER_MS - 4 * 60 * 1000;
  if (age < fadeStart) return 1;
  return DOCK_MIN_OPACITY + (1 - DOCK_MIN_OPACITY) * (1 - (age - fadeStart) / (4 * 60 * 1000));
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
      /* silent: map feed is best-effort */
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
    // A post deleted by its author drops out of every dock that still shows it.
    const onFeedDeleted = (data: { id?: string }) => {
      if (!data?.id) return;
      setMessages((prev) => prev.filter((m) => m.id !== data.id));
    };
    socket.on('map:feed:message', onFeedMsg);
    socket.on('map:feed:deleted', onFeedDeleted);
    return () => {
      socket.off('map:feed:message', onFeedMsg);
      socket.off('map:feed:deleted', onFeedDeleted);
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

  const [deleteError, setDeleteError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const focusMenuTrigger = (id: string) => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-testid="map-feed-more-${id}"]`)?.focus();
    });
  };
  const handleDelete = async (id: string) => {
    setDeleteError('');
    setDeletingId(id);
    try {
      await mapFeedAPI.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setConfirmDeleteId(null);
    } catch {
      setDeleteError('Could not delete that post. Try again.');
    } finally {
      setDeletingId(null);
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
        className="pointer-events-auto absolute bottom-12 left-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--nn-accent-text)] shadow-[var(--nn-shadow-card)] transition-transform active:scale-95"
        data-map-chrome-corner="bottom-left"
      >
        <ChatBubbleIcon className="h-5 w-5" />
        {hasNewMsg && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[var(--nn-accent-text)] ring-2 ring-[var(--bg-card)]" />
        )}
      </button>
    );
  }

  return (
    <div
      data-testid="discover-chat-dock"
      className="pointer-events-auto absolute bottom-12 left-3 z-30 flex w-[min(100%-5.5rem,340px)] flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--cream)] shadow-[var(--nn-shadow-card)]"
      data-map-chrome-corner="bottom-left"
      style={{ maxHeight: '56vh' }}
      role="dialog"
      aria-label="Nearby map chat"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] py-0.5 pl-3 pr-1">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--nn-accent-text)]" />
        <p data-testid="map-dock-label" className="flex-1 text-[15px] font-bold uppercase tracking-[0.08em] text-[var(--nn-accent-text)]">
          Nearby · Live
        </p>
        <button
          type="button"
          aria-label="Close map chat"
          onClick={handleClose}
          data-testid="map-dock-close"
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--cream-muted)] transition-colors hover:text-[var(--nn-accent-text)]"
        >
          <IconClose size={18} />
        </button>
      </div>

      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
        {visible.length === 0 ? (
          <p data-testid="map-dock-empty" className="py-8 text-center text-[15px] text-[var(--cream-muted)]">
            No nearby messages yet. Say something!
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visible.map((msg) => {
              const opacity = msgOpacity(msg);
              // sender_id, not display name: two members can share a name.
              const isMine = !!user?.id && msg.sender_id === user.id;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
                  style={{ opacity }}
                >
                  {/* Map-feed has no photos: ONE Brand placeholder face (no initials). */}
                  <div
                    className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full"
                    style={{ border: '1px solid var(--border-default)' }}
                    data-testid="map-feed-brand-face"
                  >
                    <FadedBrandFace variant="profile" size={30} label={msg.display_name || 'MenRush'} />
                  </div>
                  <div className={`flex max-w-[78%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span data-testid="map-dock-name" className="mb-0.5 text-[15px] font-semibold text-[var(--cream-muted)]">
                      {isMine ? 'You' : msg.display_name}
                      {msg.distance_label ? ` · ${msg.distance_label}` : ''}
                    </span>
                    <div className={`flex items-start gap-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <div
                      data-testid={isMine ? 'map-dock-bubble-mine' : 'map-dock-bubble'}
                      className={`px-3 py-1.5 text-[16px] leading-snug ${
                        isMine
                          ? 'rounded-[14px_14px_4px_14px] bg-[var(--nn-copper)] text-[var(--nn-on-copper)]'
                          : 'rounded-[14px_14px_14px_4px] border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--cream)]'
                      }`}
                    >
                      {msg.message}
                    </div>
                    {isMine ? (
                      <OwnPostMenu
                        label="Options for your map post"
                        testId={`map-feed-more-${msg.id}`}
                        items={[
                          {
                            label: 'Delete post',
                            danger: true,
                            testId: `map-feed-delete-${msg.id}`,
                            onSelect: () => setConfirmDeleteId(msg.id),
                          },
                        ]}
                      />
                    ) : null}
                    </div>
                    {isMine && confirmDeleteId === msg.id ? (
                      <div
                        data-testid={`map-feed-delete-confirm-${msg.id}`}
                        role="group"
                        aria-label="Delete this post?"
                        className={`mt-1.5 w-full ${CONFIRM_BOX}`}
                      >
                        <p className={CONFIRM_TITLE}>Delete this post?</p>
                        <p className={CONFIRM_BODY}>
                          You can&apos;t undo this. The location saved with it goes too.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid={`map-feed-delete-btn-${msg.id}`}
                            disabled={deletingId === msg.id}
                            onClick={() => void handleDelete(msg.id)}
                            className={CONFIRM_DANGER_BTN}
                          >
                            {deletingId === msg.id ? 'Deleting…' : 'Delete post'}
                          </button>
                          <button
                            type="button"
                            data-testid={`map-feed-delete-cancel-${msg.id}`}
                            disabled={deletingId === msg.id}
                            onClick={() => {
                              setConfirmDeleteId(null);
                              focusMenuTrigger(msg.id);
                            }}
                            className={CONFIRM_CANCEL_BTN}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <span data-testid="map-dock-time" className="mt-0.5 text-[15px] text-[var(--text-secondary)]">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            {deleteError ? (
              <p role="alert" className="text-[15px] font-semibold text-[var(--nn-danger-text)]">
                {deleteError}
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="shrink-0 border-t border-[var(--border-default)] px-3 py-2">
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
            data-testid="map-dock-input"
            className="min-h-[44px] min-w-0 flex-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-2 text-[16px] text-[var(--cream)] placeholder:text-[var(--text-secondary)] outline-none focus:ring-2 focus:ring-[var(--nn-accent-text)]"
          />
          <button
            type="button"
            disabled={!input.trim() || sending}
            onClick={() => void handleSend()}
            aria-label="Send"
            data-testid="map-dock-send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--nn-copper)] text-[var(--nn-on-copper)] transition-all active:scale-95 disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
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
