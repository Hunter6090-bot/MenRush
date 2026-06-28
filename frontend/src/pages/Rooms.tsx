import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomsAPI } from '../api/client';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { useSocket } from '../hooks/useSocket';
import { Layout } from '../components/Layout';

interface Room {
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

export const Rooms: React.FC = () => {
  const navigate = useNavigate();
  const socket = useSocket();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    roomsAPI
      .getRooms()
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.rooms ?? []);
        setRooms(list);
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  // Real-time last-message preview
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
            : r
        )
      );
    };
    socket.on('room:message', onRoomMessage);
    return () => {
      socket.off('room:message', onRoomMessage);
    };
  }, [socket]);

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-2">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #C4832A, #8B4513)' }}
          >
            <RoomsIcon className="w-5 h-5 text-white" />
          </div>
          <h1
            className="flex-1 text-xl font-bold tracking-wide"
            style={{ color: '#F0E0C0' }}
          >
            Chat Rooms
          </h1>
          <button
            onClick={() => setCreateOpen(true)}
            aria-label="Create group"
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #C4832A, #8B4513)',
              boxShadow: '0 2px 12px rgba(196,131,42,0.35)',
              color: '#fff',
            }}
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        <div className="relative mb-4">
          <SearchIcon
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: '#6B5035' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full text-sm pl-10 pr-4 py-3 rounded-2xl focus:outline-none transition-all duration-200"
            style={{
              background: '#1E1508',
              border: '1px solid #3D2B0E',
              color: '#F0E0C0',
              caretColor: '#C4832A',
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = '1px solid rgba(196,131,42,0.5)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,131,42,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = '1px solid #3D2B0E';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* ── Room list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl animate-pulse"
                style={{ background: '#1E1508' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 select-none">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: '#1E1508', border: '1px solid #3D2B0E' }}
            >
              <RoomsIcon className="w-8 h-8" style={{ color: '#C4832A', opacity: 0.5 } as React.CSSProperties} />
            </div>
            <p className="font-medium text-sm" style={{ color: '#A89070' }}>
              {search ? 'No rooms match your search' : 'No rooms yet'}
            </p>
            {!search && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #C4832A, #8B4513)',
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
            {filtered.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/rooms/${room.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-150 active:scale-[0.98] text-left"
                style={{
                  background: '#1E1508',
                  border: '1px solid #3D2B0E',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = '1px solid rgba(196,131,42,0.35)';
                  (e.currentTarget as HTMLElement).style.background = '#231a09';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = '1px solid #3D2B0E';
                  (e.currentTarget as HTMLElement).style.background = '#1E1508';
                }}
              >
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(196,131,42,0.25), rgba(139,69,19,0.15))',
                    border: '1px solid rgba(196,131,42,0.25)',
                    color: '#C4832A',
                  }}
                >
                  {roomInitials(room.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-semibold text-sm truncate"
                      style={{ color: '#F0E0C0' }}
                    >
                      {room.name}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: '#6B5035' }}>
                      {formatRelative(room.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span
                      className="text-xs truncate"
                      style={{ color: '#6B5035' }}
                    >
                      {room.last_message ?? `${room.member_count} members`}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px]" style={{ color: '#6B5035' }}>
                        <GroupIcon className="w-3 h-3 inline mr-0.5" />
                        {room.member_count}
                      </span>
                      {(room.unread_count ?? 0) > 0 && (
                        <span
                          className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold px-1"
                          style={{
                            background: 'linear-gradient(135deg, #C4832A, #8B4513)',
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
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          roomsAPI
            .getRooms()
            .then((r) => {
              const list = Array.isArray(r.data) ? r.data : (r.data?.member_rooms ?? r.data?.rooms ?? []);
              setRooms(list);
            })
            .catch(() => {});
        }}
      />
    </Layout>
  );
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const RoomsIcon = ({
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
    strokeWidth={2}
  >
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

const SearchIcon = ({
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
    strokeWidth={2}
  >
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
