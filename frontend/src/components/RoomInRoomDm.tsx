import React, { useEffect, useRef, useState } from 'react';
import { getPhotoUrl } from './UserAvatar';

export type InRoomDmMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
};

type Props = {
  peerId: string;
  peerName: string;
  peerPhotoUrl?: string | null;
  selfId: string;
  messages: InRoomDmMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
  notice?: string | null;
};

/**
 * In-room 1:1 window — lives inside the group only.
 * Room identity labels only. Never deep-links to main profile.
 */
export const RoomInRoomDm: React.FC<Props> = ({
  peerId,
  peerName,
  peerPhotoUrl,
  selfId,
  messages,
  onSend,
  onClose,
  notice,
}) => {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photo = getPhotoUrl(peerPhotoUrl ?? undefined);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [peerId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-default)]"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}
      data-testid="room-inroom-dm"
      data-peer-id={peerId}
    >
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border-default)] px-3 py-2.5">
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
          style={{
            background: 'rgba(196,131,42,0.18)',
            border: '1px solid rgba(196,131,42,0.3)',
            color: '#C4832A',
          }}
          aria-hidden
        >
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            peerName.slice(0, 2).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--cream)]">{peerName}</p>
          <p className="text-[10px] text-[var(--cream-muted)]">In-room 1:1 · gone when either leaves</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Leave this 1:1"
          data-testid="room-inroom-dm-close"
          className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--cream-muted)] hover:bg-[var(--border-default)]/40 hover:text-[var(--cream)]"
        >
          Leave
        </button>
      </header>

      {notice ? (
        <p
          className="flex-shrink-0 border-b border-[var(--border-default)] px-3 py-1.5 text-center text-[11px]"
          style={{ color: '#C4832A', background: 'rgba(196,131,42,0.08)' }}
          data-testid="room-inroom-dm-notice"
        >
          {notice}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--cream-muted)]">
            Private to you two. Leaves with the room.
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.sender_id === selfId;
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 text-sm leading-snug"
                  style={
                    mine
                      ? {
                          background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                          color: '#FFF5E6',
                          borderRadius: '14px 14px 4px 14px',
                        }
                      : {
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--cream)',
                          borderRadius: '14px 14px 14px 4px',
                        }
                  }
                >
                  {!mine ? (
                    <span className="mb-0.5 block text-[10px] font-semibold opacity-70">
                      {msg.sender_name}
                    </span>
                  ) : null}
                  <span className="whitespace-pre-wrap break-words">{msg.message}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-shrink-0 items-center gap-2 border-t border-[var(--border-default)] px-2 py-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${peerName}…`}
          autoComplete="off"
          maxLength={2000}
          data-testid="room-inroom-dm-input"
          className="min-w-0 flex-1 rounded-full px-4 py-2 text-sm focus:outline-none"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-default)',
            color: 'var(--cream)',
            caretColor: '#C4832A',
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          data-testid="room-inroom-dm-send"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg, #C4832A, #A45E18)' }}
          aria-label="Send"
        >
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
};
