import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { messagesAPI, roomsAPI, usersAPI } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../hooks/store';
import { useRoomVideo } from '../hooks/useRoomVideo';
import { RoomGalleryGrid } from '../components/RoomGalleryGrid';
import { PulseRing } from '../components/PulseRing';
import { MobileBackButton } from '../components/MobileBackButton';
import { ChatSafetyMenu } from '../components/ChatSafetyMenu';

interface RoomMessage {
  id?: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at?: string;
  reply_to?: string;
}

interface RoomInfo {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  user_role?: string | null;
  is_location_based?: boolean;
}

interface RoomMember {
  id: string;
  name: string;
  photo_url?: string;
  role?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Deterministic color per sender
const SENDER_COLORS = [
  '#C4832A',
  '#8B9EFF',
  '#FF8C6B',
  '#6BC8C4',
  '#D4A8FF',
  '#80C880',
  '#FFD066',
];

function senderColor(senderId: string): string {
  let hash = 0;
  for (let i = 0; i < senderId.length; i++) {
    hash = (hash * 31 + senderId.charCodeAt(i)) >>> 0;
  }
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}

// ── Main component ────────────────────────────────────────────────────────────

export const RoomChat: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  const user = useAuthStore((s) => s.user);

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [addCandidates, setAddCandidates] = useState<RoomMember[]>([]);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(
    (location.state as { groupNotice?: string } | null)?.groupNotice ?? null,
  );
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId → name
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const {
    participants,
    pinnedId,
    setPinnedId,
    cameraOn,
    micMuted,
    mediaError: videoError,
    loadMembers,
    applyPresenceSync,
    upsertParticipant,
    markOffline,
    getStreamFor,
    toggleCamera,
    toggleMic,
    photoUrl,
  } = useRoomVideo({ roomId, userId: user?.id, enabled: !!roomId });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load room info + messages ────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    roomsAPI.getRoom(roomId).then((r) => setRoom(r.data)).catch(() => {});
    roomsAPI.getMessages(roomId).then((r) => setMessages(r.data)).catch(() => {});
    roomsAPI
      .getMembers(roomId)
      .then((r) => loadMembers(r.data.map((m) => ({ id: m.id, name: m.name, photo_url: m.photo_url }))))
      .catch(() => {});
  }, [roomId, loadMembers]);

  useEffect(() => {
    if (!roomId || !settingsOpen) return;
    roomsAPI
      .getMembers(roomId)
      .then((r) => setMembers(r.data))
      .catch(() => setMembers([]));
  }, [roomId, settingsOpen]);

  useEffect(() => {
    if (!addPanelOpen) return;
    Promise.all([usersAPI.getMatches(), messagesAPI.getConversations()])
      .then(([matchesRes, convsRes]) => {
        const byId = new Map<string, RoomMember>();
        for (const match of matchesRes.data ?? []) {
          byId.set(match.id, { id: match.id, name: match.name, photo_url: match.photo_url });
        }
        for (const conv of convsRes.data ?? []) {
          if (!byId.has(conv.other_user_id)) {
            byId.set(conv.other_user_id, {
              id: conv.other_user_id,
              name: conv.other_user_name,
              photo_url: conv.photo_url,
            });
          }
        }
        const existing = new Set(members.map((m) => m.id));
        setAddCandidates(
          Array.from(byId.values())
            .filter((c) => !existing.has(c.id) && c.id !== user?.id)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => setAddCandidates([]));
  }, [addPanelOpen, members, user?.id]);

  // ── Socket: join/leave ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit('room:join', { roomId });
    return () => {
      socket.emit('room:leave', { roomId });
    };
  }, [socket, roomId]);

  // ── Socket: events ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !roomId) return;

    const onMessage = (data: RoomMessage) => {
      if (data.room_id !== roomId) return;
      setMessages((prev) => [...prev, data]);
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[data.sender_id];
        return next;
      });
    };

    const onPresence = (data: {
      room_id: string;
      type: 'join' | 'leave';
      user_id: string;
      name?: string;
      photo_url?: string | null;
    }) => {
      if (data.room_id !== roomId) return;
      if (data.type === 'leave') {
        markOffline(data.user_id);
        return;
      }
      upsertParticipant({
        user_id: data.user_id,
        name: data.name ?? 'Member',
        photo_url: data.photo_url,
        isLive: true,
        isSelf: data.user_id === user?.id,
      });
    };

    const onPresenceSync = (data: {
      room_id: string;
      participants: Array<{ user_id: string; name: string; photo_url?: string | null }>;
    }) => {
      if (data.room_id !== roomId) return;
      applyPresenceSync(data.participants);
    };

    const onTyping = ({
      roomId: incomingRoomId,
      room_id: incomingRoomIdSnake,
      userId,
      user_id: userIdSnake,
      user_name,
      typing,
    }: {
      roomId?: string;
      room_id?: string;
      userId?: string;
      user_id?: string;
      user_name?: string;
      typing: boolean;
    }) => {
      const rid = incomingRoomId || incomingRoomIdSnake;
      const uid = userId || userIdSnake;
      if (!rid || rid !== roomId || !uid || uid === user?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing && user_name) {
          next[uid] = user_name;
        } else {
          delete next[uid];
        }
        return next;
      });
    };

    socket.on('room:message', onMessage);
    socket.on('room:presence', onPresence);
    socket.on('room:presence-sync', onPresenceSync);
    socket.on('room:typing', onTyping);
    return () => {
      socket.off('room:message', onMessage);
      socket.off('room:presence', onPresence);
      socket.off('room:presence-sync', onPresenceSync);
      socket.off('room:typing', onTyping);
    };
  }, [socket, roomId, user?.id, upsertParticipant, markOffline, applyPresenceSync]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // ── Typing emit ──────────────────────────────────────────────────────────
  const emitTyping = useCallback(
    (typing: boolean) => {
      socket?.emit('room:typing', { roomId, typing });
    },
    [socket, roomId]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    emitTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 2000);
  };

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId || !user) return;

    emitTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);

    const text = input.trim();
    setInput('');
    setSending(true);
    inputRef.current?.focus();

    try {
      const res = await roomsAPI.sendMessage(roomId, text);
      setMessages((prev) => [...prev, res.data]);
    } catch {
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

  // ── Typing label ─────────────────────────────────────────────────────────
  const typingLabel = (() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  })();

  const liveCount = participants.filter((p) => p.isLive).length;
  const isOwner = room?.user_role === 'owner';
  const isPrivateGroup = room?.is_location_based === false;

  const handleAddMember = async (targetId: string, targetName: string) => {
    if (!roomId || addingMemberId) return;
    setAddingMemberId(targetId);
    try {
      await roomsAPI.addMember(roomId, targetId);
      setSettingsNotice(`${targetName} was added to the group.`);
      const res = await roomsAPI.getMembers(roomId);
      setMembers(res.data);
      setAddCandidates((prev) => prev.filter((c) => c.id !== targetId));
      roomsAPI.getRoom(roomId).then((r) => setRoom(r.data)).catch(() => {});
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (code === 'member_premium_required') {
        setSettingsNotice(`${targetName} needs Premium to join groups.`);
      } else {
        setSettingsNotice(
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            `Could not add ${targetName}.`,
        );
      }
    } finally {
      setAddingMemberId(null);
    }
  };

  const galleryParticipants = participants.map((p) =>
    p.isSelf ? { ...p, isMuted: micMuted } : p,
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={embedded ? 'flex h-full min-h-0 flex-col' : 'fixed inset-0 flex flex-col'}
      style={{ background: '#050403' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className={`flex-shrink-0 flex items-center gap-2 border-b px-3 sm:px-4 ${
          embedded ? '' : 'pt-[env(safe-area-inset-top,0px)]'
        }`}
        style={{
          minHeight: embedded ? '4rem' : 'calc(4rem + env(safe-area-inset-top, 0px))',
          background: 'rgba(13,10,6,0.94)',
          borderColor: '#3D2B0E',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 20,
        }}
      >
        {!embedded ? (
          <MobileBackButton
            fallback="/rooms"
            onClick={() => navigate('/rooms')}
            className="-ml-1"
          />
        ) : null}

        {/* Room avatar */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(196,131,42,0.3), rgba(139,69,19,0.2))',
            border: '1px solid rgba(196,131,42,0.3)',
            color: '#C4832A',
          }}
        >
          {room ? initials(room.name) : '…'}
        </div>

        {/* Room name + members */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate" style={{ color: '#F0E0C0' }}>
            {room?.name ?? 'Room'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#6B5035' }}>
            <GroupIcon className="w-3 h-3 inline mr-0.5" />
            {liveCount > 0 ? `${liveCount} live` : `${room?.member_count ?? '—'} members`}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleMic}
          aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
          style={{ color: micMuted ? '#EF4444' : '#A89070' }}
        >
          {micMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
          style={{ color: cameraOn ? '#C4832A' : '#EF4444' }}
        >
          <CamIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
          style={{ color: chatOpen ? '#C4832A' : '#A89070' }}
        >
          <BubbleIcon className="w-5 h-5" />
        </button>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Room settings"
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
          style={{ color: '#A89070' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F0E0C0')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#A89070')}
        >
          <GearIcon className="w-5 h-5" />
        </button>
      </header>

      {/* ── Settings sheet ────────────────────────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => {
            setSettingsOpen(false);
            setAddPanelOpen(false);
          }}
        >
          <div
            className="absolute right-4 top-16 w-72 max-h-[70vh] overflow-y-auto rounded-2xl overflow-hidden animate-scale-up"
            style={{
              background: '#1E1508',
              border: '1px solid #3D2B0E',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {room?.description && (
              <div
                className="px-4 py-3 text-xs border-b"
                style={{ color: '#A89070', borderColor: '#3D2B0E' }}
              >
                {room.description}
              </div>
            )}

            {settingsNotice && (
              <div
                className="px-4 py-2 text-xs border-b"
                style={{ color: '#F0E0C0', borderColor: '#3D2B0E', background: 'rgba(196,131,42,0.08)' }}
              >
                {settingsNotice}
              </div>
            )}

            <div className="px-4 py-3 border-b" style={{ borderColor: '#3D2B0E' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B5035' }}>
                Members
              </p>
              <div className="space-y-1">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm truncate" style={{ color: '#F0E0C0' }}>
                      {member.name}
                      {member.role === 'owner' ? (
                        <span className="ml-1 text-[10px]" style={{ color: '#C4832A' }}>
                          · owner
                        </span>
                      ) : null}
                    </span>
                    {member.id !== user?.id && (
                      <ChatSafetyMenu
                        peerId={member.id}
                        peerName={member.name}
                        onNotice={(msg) => setSettingsNotice(msg)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isOwner && isPrivateGroup && (
              <div className="border-b" style={{ borderColor: '#3D2B0E' }}>
                <button
                  type="button"
                  onClick={() => setAddPanelOpen((v) => !v)}
                  className="w-full px-4 py-3 text-sm text-left transition-all duration-150 hover:bg-[#3D2B0E]/50"
                  style={{ color: '#C4832A' }}
                >
                  {addPanelOpen ? 'Hide add member' : 'Add Premium member'}
                </button>
                {addPanelOpen && (
                  <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
                    {addCandidates.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: '#6B5035' }}>
                        No one else to add right now.
                      </p>
                    ) : (
                      addCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={addingMemberId === candidate.id}
                          onClick={() => void handleAddMember(candidate.id, candidate.name)}
                          className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-[#3D2B0E]/40 disabled:opacity-50"
                          style={{ color: '#F0E0C0' }}
                        >
                          {addingMemberId === candidate.id ? 'Adding…' : candidate.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={async () => {
                if (!roomId) return;
                try {
                  await roomsAPI.leaveRoom(roomId);
                  navigate('/rooms');
                } catch {
                  // ignore
                }
              }}
              className="w-full px-4 py-3 text-sm text-left transition-all duration-150 hover:bg-[#3D2B0E]/50"
              style={{ color: '#EF4444' }}
            >
              Leave Room
            </button>
          </div>
        </div>
      )}

      {videoError && (
        <div
          className="mx-3 mt-2 rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'rgba(196,131,42,0.35)', background: 'rgba(196,131,42,0.1)', color: '#F0E0C0' }}
        >
          {videoError}
        </div>
      )}

      {/* ── Video gallery (primary surface) ─────────────────────────────── */}
      <div className="min-h-0 flex-1">
        <RoomGalleryGrid
          participants={galleryParticipants}
          pinnedId={pinnedId}
          onPin={setPinnedId}
          getStreamFor={getStreamFor}
          photoUrl={photoUrl}
          cameraOnForSelf={cameraOn}
        />
      </div>

      {/* ── Chat drawer ───────────────────────────────────────────────── */}
      <div
        className={`flex shrink-0 flex-col border-t transition-[height] duration-300 ease-out ${
          chatOpen ? 'h-[42vh] min-h-[220px]' : 'h-0 overflow-hidden border-transparent'
        }`}
        style={{ borderColor: '#3D2B0E', background: '#0D0A06' }}
      >
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'thin' }}>
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
              Be the first to say something
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
          const showSenderName = !isMine && !isGrouped;
          const color = senderColor(msg.sender_id);

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
                {/* Other user: avatar */}
                {!isMine && (
                  <div className="w-8 flex-shrink-0 mr-2 flex items-end mb-1">
                    {showTail && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `${color}22`,
                          border: `1px solid ${color}44`,
                          color,
                          flexShrink: 0,
                        }}
                      >
                        {initials(msg.sender_name)}
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[72%]`}
                >
                  {/* Sender name — shown for others, first in a group */}
                  {showSenderName && (
                    <span
                      className="text-[10px] font-semibold mb-1 px-1"
                      style={{ color }}
                    >
                      {msg.sender_name}
                    </span>
                  )}

                  <div
                    className="relative px-4 py-2.5 text-sm leading-relaxed"
                    style={
                      isMine
                        ? {
                            background: 'linear-gradient(135deg, #C4832A, #A45E18)',
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
                  {showTail && (
                    <span className="text-[10px] mt-1 px-1" style={{ color: '#6B5035' }}>
                      {formatTime(msg.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {typingLabel && (
          <div className="flex justify-start mt-3 items-center gap-2 pl-10">
            <div
              className="px-4 py-2.5 rounded-[18px] rounded-bl-[4px] flex items-center gap-1.5"
              style={{ background: '#1E1508', border: '1px solid #3D2B0E' }}
            >
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
            </div>
            <span className="text-[10px]" style={{ color: '#6B5035' }}>
              {typingLabel}
            </span>
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
          {/* Attachment icon */}
          <button
            type="button"
            aria-label="Attach file"
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
            style={{ color: '#6B5035' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#A89070')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6B5035')}
          >
            <AttachIcon className="w-5 h-5" />
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message the room…"
            autoComplete="off"
            className="flex-1 text-sm px-5 py-3 rounded-full focus:outline-none transition-all duration-200"
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

          {/* Emoji button */}
          <button
            type="button"
            aria-label="Emoji"
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
            style={{ color: '#6B5035' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#A89070')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6B5035')}
          >
            <EmojiIcon className="w-5 h-5" />
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #C4832A, #A45E18)',
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
      </div>
    </div>
  );
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const GearIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const AttachIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
    />
  </svg>
);

const EmojiIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.5 14s1.5 2 3.5 2 3.5-2 3.5-2M9 9h.01M15 9h.01"
    />
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

const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM5 12a7 7 0 0014 0M12 19v3" />
  </svg>
);

const MicOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12a7 7 0 0014 0M12 19v3M9 9v3a3 3 0 015.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
  </svg>
);

const CamIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z" />
  </svg>
);
