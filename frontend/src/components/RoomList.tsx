import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomsAPI } from '../api/client';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { useSocket } from '../hooks/useSocket';

export interface RoomRow {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

function roomInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface RoomListProps {
  activeRoomId?: string;
  variant?: 'mobile' | 'sidebar';
  showHeader?: boolean;
  className?: string;
}

export const RoomList: React.FC<RoomListProps> = ({
  activeRoomId,
  variant = 'mobile',
  showHeader = true,
  className = '',
}) => {
  const navigate = useNavigate();
  const socket = useSocket();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const isSidebar = variant === 'sidebar';

  const refreshRooms = () => {
    roomsAPI
      .getRooms()
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.rooms ?? []);
        setRooms(list);
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshRooms();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onRoomMessage = (data: {
      room_id: string;
      message: string;
      created_at: string;
      sender_name?: string;
    }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === data.room_id
            ? {
                ...r,
                last_message: data.sender_name
                  ? `${data.sender_name}: ${data.message}`
                  : data.message,
                last_message_at: data.created_at,
                unread_count: (r.unread_count ?? 0) + 1,
              }
            : r,
        ),
      );
    };
    socket.on('room:message', onRoomMessage);
    return () => {
      socket.off('room:message', onRoomMessage);
    };
  }, [socket]);

  const filtered = rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {showHeader && (
        <div
          className={`flex shrink-0 items-center gap-3 border-b border-[var(--border-default)] ${
            isSidebar ? 'px-4 py-4' : 'mb-5'
          }`}
        >
          {!isSidebar ? (
            <>
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, #C4832A, #A45E18)' }}
              >
                <RoomsIcon className="h-5 w-5 text-white" />
              </div>
              <h1 className="flex-1 text-xl font-bold tracking-wide" style={{ color: 'var(--cream)' }}>
                Chat Rooms
              </h1>
            </>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
                Groups
              </p>
              <p className="text-sm font-semibold text-[var(--cream)]">Your rooms</p>
            </div>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            aria-label="Create group"
            className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #C4832A, #A45E18)',
              boxShadow: '0 2px 12px rgba(196,131,42,0.35)',
              color: '#fff',
            }}
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className={`shrink-0 ${isSidebar ? 'px-3 pt-3' : 'mb-4'}`}>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: '#6B5035' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm transition-all duration-200 focus:outline-none"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              color: 'var(--cream)',
              caretColor: '#C4832A',
            }}
          />
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${isSidebar ? 'px-2 pb-3' : ''}`}>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl" style={{ background: 'var(--bg-card)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex select-none flex-col items-center justify-center py-20">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <RoomsIcon className="h-8 w-8" style={{ color: '#C4832A', opacity: 0.5 } as React.CSSProperties} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--cream-muted)' }}>
              {search ? 'No rooms match your search' : 'No rooms yet'}
            </p>
            {!search && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                  color: '#FFF5E6',
                  boxShadow: '0 2px 12px rgba(196,131,42,0.35)',
                }}
              >
                Create a Group
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((room) => {
              const active = activeRoomId === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => navigate(`/rooms/${room.id}`)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                    isSidebar && active
                      ? 'border border-[var(--copper)]/40 bg-[var(--copper)]/12 shadow-[inset_3px_0_0_var(--copper)]'
                      : ''
                  }`}
                  style={
                    isSidebar && active
                      ? undefined
                      : { background: 'var(--bg-card)', border: '1px solid var(--border-default)' }
                  }
                >
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-base font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(196,131,42,0.25), rgba(139,69,19,0.15))',
                      border: '1px solid rgba(196,131,42,0.25)',
                      color: '#C4832A',
                    }}
                  >
                    {roomInitials(room.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold" style={{ color: 'var(--cream)' }}>
                        {room.name}
                      </span>
                      <span className="flex-shrink-0 text-[10px]" style={{ color: '#6B5035' }}>
                        {formatRelative(room.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs" style={{ color: '#6B5035' }}>
                        {room.last_message ?? `${room.member_count} members`}
                      </span>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        <span className="text-[10px]" style={{ color: '#6B5035' }}>
                          <GroupIcon className="mr-0.5 inline h-3 w-3" />
                          {room.member_count}
                        </span>
                        {(room.unread_count ?? 0) > 0 && (
                          <span
                            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                            style={{
                              background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                              color: '#fff',
                            }}
                          >
                            {(room.unread_count ?? 0) > 9 ? '9+' : room.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshRooms}
      />
    </div>
  );
};

const RoomsIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const SearchIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);

const GroupIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);
