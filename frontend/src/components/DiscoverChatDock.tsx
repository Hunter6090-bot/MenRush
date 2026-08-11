import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { Messages } from '../pages/Messaging';
import { IconChat, IconClose } from './icons';
import { useUnreadStore } from '../hooks/store';

const DOCK_STORAGE_KEY = 'menrush_discover_chat_dock';

function readDockOpen(): boolean {
  try {
    return localStorage.getItem(DOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Floating inbox dock over Discover map — list + thread without leaving Nearby.
 */
export function DiscoverChatDock({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [peerId, setPeerId] = useState<string | null>(null);
  const unread = useUnreadStore((s) => s.count);

  useEffect(() => {
    try {
      localStorage.setItem(DOCK_STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!open) setPeerId(null);
  }, [open]);

  return (
    <>
      {!open ? (
        <button
          type="button"
          data-testid="discover-chat-dock-toggle"
          aria-label={unread > 0 ? `Open chat, ${unread} unread` : 'Open chat'}
          title="Chat"
          onClick={() => onOpenChange(true)}
          className="pointer-events-auto absolute right-3 top-14 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(196,131,42,0.45)] bg-[color-mix(in_srgb,#FFF8F0_94%,transparent)] text-[#3D2B0E] shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition-transform active:scale-95 sm:top-16"
        >
          <IconChat size={22} />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C4832A] px-1 text-[10px] font-extrabold text-[#1A0E03]">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      ) : null}

      {open ? (
        <div
          data-testid="discover-chat-dock"
          className="pointer-events-auto absolute bottom-3 right-3 top-14 z-30 flex w-[min(100%-1.5rem,380px)] flex-col overflow-hidden rounded-2xl border border-[rgba(196,131,42,0.4)] bg-[color-mix(in_srgb,var(--bg-primary)_96%,transparent)] shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:top-16"
          role="dialog"
          aria-label="Chat"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] px-3 py-2.5">
            {peerId ? (
              <button
                type="button"
                onClick={() => setPeerId(null)}
                className="rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#C4832A] hover:bg-[rgba(196,131,42,0.12)]"
              >
                Inbox
              </button>
            ) : (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cream-muted)]">
                Chat
              </p>
            )}
            <div className="min-w-0 flex-1" />
            <Link
              to="/conversations"
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]"
            >
              Full inbox
            </Link>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--cream-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--cream)]"
            >
              <IconClose size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {peerId ? (
              <Messages
                embedded
                otherUserId={peerId}
                onBack={() => setPeerId(null)}
              />
            ) : (
              <ConversationList
                variant="sidebar"
                showHeader={false}
                className="h-full"
                onSelectUser={setPeerId}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export { readDockOpen };
