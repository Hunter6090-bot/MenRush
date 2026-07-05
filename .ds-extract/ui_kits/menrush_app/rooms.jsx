// MenRush — Rooms (group chat).
// RoomsListScreen — directory of nearby rooms, joinable.
// RoomChatScreen — multi-participant chat with avatar gutter.
// Globals: MR_PALETTE, Icon, Button, PulsingAvatar, MessageBubble, TopBar, TribePill, BottomNav

const MR_ROOMS = [
  { id: 'r1',  name: 'East Village Tonight',     tribe: 'Open',     distMi: 0.8, active: 24, pulsing: true,  desc: 'Anyone out tonight in EV?', lastFrom: 'Marcus',  lastMsg: 'Stonewall back patio after 11', lastTime: '2m' },
  { id: 'r2',  name: 'Leather Pride NYC',         tribe: 'Leather',  distMi: 1.6, active: 18, pulsing: true,  desc: 'Pre-game and meetups for fetish nights.', lastFrom: 'Reyes',   lastMsg: 'EAGLE is packed.', lastTime: '6m' },
  { id: 'r3',  name: 'Bears @ Brooklyn',           tribe: 'Bear',     distMi: 3.4, active: 12, pulsing: false, desc: 'Brunch, brews, and friends.', lastFrom: 'Theo',    lastMsg: 'New spot on Bedford?', lastTime: '14m' },
  { id: 'r4',  name: 'Daddy / Boy',                tribe: 'Daddy',    distMi: 2.1, active: 9,  pulsing: false, desc: 'Mentorship and meets. 30+ only.', lastFrom: 'Joaquin', lastMsg: 'On it.', lastTime: '38m' },
  { id: 'r5',  name: 'Jock Talk',                  tribe: 'Jock',     distMi: 0.4, active: 31, pulsing: true,  desc: 'Gym, workout buddies, post-lift hangs.', lastFrom: 'Dane',    lastMsg: 'PR today. Anyone lifting tomorrow?', lastTime: '1h' },
  { id: 'r6',  name: 'New in town',                tribe: 'Open',     distMi: 4.9, active: 7,  pulsing: false, desc: 'Just moved? Say hi.', lastFrom: 'Kavi',    lastMsg: 'British, here a week.', lastTime: '2h' },
];

// ── Rooms list ─────────────────────────────────────────────
const ROOM_CATS = ['All', 'Nearby', 'Open', 'Leather', 'Bear', 'Daddy', 'Jock', 'Tonight'];

function RoomsListScreen({ onOpenRoom, onCreate }) {
  const [rooms, setRooms] = React.useState(MR_ROOMS);
  const [cat, setCat] = React.useState('Nearby');
  const [createOpen, setCreateOpen] = React.useState(false);

  let shown = rooms;
  if (cat === 'Nearby') shown = [...rooms].sort((a, b) => a.distMi - b.distMi);
  else if (cat === 'Tonight') shown = rooms.filter(r => r.pulsing);
  else if (cat !== 'All') shown = rooms.filter(r => r.tribe === cat);

  const openCreate = () => setCreateOpen(true);

  return (
    <div className="scroll" style={{ flex: 1, paddingBottom: 110, overflowY: 'auto' }}>
      <TopBar
        title="ROOMS"
        subtitle={`${rooms.reduce((a, r) => a + r.active, 0)} men active across ${rooms.length} rooms`}
        right={<button onClick={openCreate} style={roomsIconBtn(true)} title="New room"><Icon name="more" size={20} strokeWidth={2} /></button>}
      />
      {/* category strip */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 4px', overflowX: 'auto' }}>
        {ROOM_CATS.map(c => (
          <TribePill key={c} active={c === cat} onClick={() => setCat(c)}>{c}</TribePill>
        ))}
      </div>
      <div style={{ padding: '6px 12px' }}>
        {shown.map(r => (
          <RoomRow key={r.id} room={r} onOpen={() => onOpenRoom(r)} />
        ))}
        {shown.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: MR_PALETTE.muted }}>
            No rooms here yet. Start one.
          </div>
        )}
      </div>
      {/* Empty/Create card */}
      <div style={{ padding: '12px 16px' }}>
        <button onClick={openCreate} style={{
          width: '100%', padding: '14px 16px', borderRadius: 14,
          background: 'transparent', border: `1px dashed ${MR_PALETTE.copper}55`,
          color: MR_PALETTE.copper, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Start a room</button>
      </div>
      {createOpen && (
        <CreateRoomSheet
          onClose={() => setCreateOpen(false)}
          onCreate={(room) => { setRooms(rs => [room, ...rs]); setCreateOpen(false); setCat('All'); }}
        />
      )}
    </div>
  );
}

function CreateRoomSheet({ onClose, onCreate }) {
  const [name, setName] = React.useState('');
  const [tribe, setTribe] = React.useState('Open');
  const create = () => {
    if (!name.trim()) return;
    onCreate({
      id: 'new-' + Date.now(), name: name.trim(), tribe, distMi: 0,
      active: 1, pulsing: true, desc: '', lastFrom: 'You', lastMsg: 'Room created.', lastTime: 'now',
    });
  };
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: MR_PALETTE.card,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderTop: `1px solid ${MR_PALETTE.border}`,
        boxShadow: '0 -24px 64px rgba(0,0,0,.7)',
        animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
        padding: '10px 20px 40px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 6px' }}>
          <span style={{ width: 40, height: 4, borderRadius: 2, background: MR_PALETTE.border }} />
        </div>
        <h3 style={{
          margin: '8px 0 14px', fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 900,
          letterSpacing: '0.06em', textTransform: 'uppercase', color: MR_PALETTE.text,
        }}>Start a room</h3>
        <input
          value={name} onChange={e => setName(e.target.value)} autoFocus
          onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="Room name — direct, no fluff"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 12,
            background: MR_PALETTE.elevated, border: `1px solid ${MR_PALETTE.border}`,
            color: MR_PALETTE.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: MR_PALETTE.muted, margin: '16px 0 8px' }}>TRIBE</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Open', 'Leather', 'Bear', 'Daddy', 'Jock', 'Otter', 'Twink'].map(t => (
            <TribePill key={t} active={t === tribe} onClick={() => setTribe(t)}>{t}</TribePill>
          ))}
        </div>
        <div style={{ marginTop: 20 }}>
          <Button variant="primary" full size="lg" disabled={!name.trim()} onClick={create}>CREATE ROOM</Button>
        </div>
      </div>
    </div>
  );
}

function RoomRow({ room, onOpen }) {
  return (
    <button onClick={onOpen} style={{
      width: '100%', display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 14px', borderRadius: 14, marginBottom: 8,
      background: MR_PALETTE.card, border: `1px solid ${MR_PALETTE.border}`,
      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
      boxShadow: 'inset 0 1px 0 rgba(255,200,130,.04)',
    }}>
      <RoomGlyph tribe={room.tribe} pulsing={room.pulsing} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: MR_PALETTE.text }}>{room.name}</span>
          <span style={{ fontSize: 10, color: MR_PALETTE.faint, fontFamily: 'ui-monospace, monospace' }}>
            · {room.distMi < 1 ? `${Math.round(room.distMi*1760)} yd` : `${room.distMi.toFixed(1)} mi`}
          </span>
        </div>
        <div style={{ fontSize: 12, color: MR_PALETTE.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <b style={{ color: MR_PALETTE.text, fontWeight: 600 }}>{room.lastFrom}</b>: {room.lastMsg}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: MR_PALETTE.faint, fontFamily: 'ui-monospace, monospace' }}>{room.lastTime}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: room.pulsing ? `${MR_PALETTE.copper}1f` : 'rgba(168,144,112,.06)',
          color: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted,
          border: room.pulsing ? `1px solid ${MR_PALETTE.copper}33` : `1px solid ${MR_PALETTE.border}`,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted }} />
          {room.active}
        </span>
      </div>
    </button>
  );
}

function RoomGlyph({ tribe, pulsing }) {
  const letter = tribe === 'Open' ? '●' : tribe[0];
  return (
    <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
      {pulsing && <span style={{ position: 'absolute', inset: 0, borderRadius: 12, background: MR_PALETTE.copper, opacity: .35, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite', transformOrigin: 'center' }} />}
      <div style={{
        width: 50, height: 50, borderRadius: 12,
        background: `linear-gradient(160deg, ${MR_PALETTE.elevated}, ${MR_PALETTE.card})`,
        border: `1.5px solid ${MR_PALETTE.copper}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: MR_PALETTE.copper, fontWeight: 900, fontSize: 18, letterSpacing: '0.04em',
        boxShadow: `0 0 0 3px ${MR_PALETTE.copper}1a, 0 4px 12px rgba(0,0,0,.4)`,
        position: 'relative', zIndex: 2,
      }}>{letter}</div>
    </div>
  );
}

// ── Room chat (group thread) ────────────────────────────────
const MR_ROOM_MESSAGES = [
  { from: 'Marcus',  initial: 'M', mine: false, text: 'who\'s out tonight in EV?',                  time: '10:14 PM', verified: true },
  { from: 'Reyes',   initial: 'R', mine: false, text: 'EAGLE\'s mine. Doors at 11.',                 time: '10:15 PM', verified: true },
  { from: 'Dane',    initial: 'D', mine: false, text: 'cover?',                                      time: '10:15 PM' },
  { from: 'Reyes',   initial: 'R', mine: false, text: '$15 before midnight.',                        time: '10:16 PM', verified: true },
  { from: 'You',     initial: 'Y', mine: true,  text: 'i\'ll be there. Stonewall back patio first.', time: '10:18 PM' },
  { from: 'Marcus',  initial: 'M', mine: false, text: 'meet you there. cigar bar after?',            time: '10:18 PM', verified: true },
];

function RoomChatScreen({ room, onBack, onOpenMember }) {
  const [messages, setMessages] = React.useState(MR_ROOM_MESSAGES);
  const [draft, setDraft] = React.useState('');
  const [joined, setJoined] = React.useState(true);
  const ref = React.useRef(null);
  const send = () => {
    if (!draft.trim()) return;
    setMessages(m => [...m, { from: 'You', initial: 'Y', mine: true, text: draft.trim(), time: 'now' }]);
    setDraft('');
    setTimeout(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, 50);
  };

  // Decide when to show the avatar (first msg from sender in a streak)
  const withMeta = messages.map((m, i, arr) => ({
    ...m,
    showName: !m.mine && (i === 0 || arr[i-1].from !== m.from),
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: MR_PALETTE.bg, zIndex: 40 }}>
      <TopBar
        left={<button onClick={onBack} style={roomsIconBtn()}><Icon name="chevron-left" size={22} strokeWidth={2.2} /></button>}
        right={<MoreMenu style={roomsIconBtn()} items={[
          { label: 'Room info' },
          { label: 'Mute room' },
          { label: 'Report room', danger: true },
          { label: 'Leave room', danger: true },
        ]} />}
      />
      {/* room identity strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: MR_PALETTE.card, borderBottom: `1px solid ${MR_PALETTE.border}`,
      }}>
        <RoomGlyph tribe={room.tribe} pulsing={room.pulsing} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: MR_PALETTE.text }}>{room.name}</div>
          <div style={{ fontSize: 11, color: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted, marginTop: 1 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted, boxShadow: room.pulsing ? `0 0 8px ${MR_PALETTE.copper}` : 'none' }} />
              {room.active} active
            </span>
            <span style={{ color: MR_PALETTE.faint }}> · {room.tribe} · {room.distMi < 1 ? `${Math.round(room.distMi*1760)} yd` : `${room.distMi.toFixed(1)} mi`}</span>
          </div>
        </div>
        <button onClick={() => setJoined(j => !j)} style={{
          padding: '6px 12px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', borderRadius: 999, fontFamily: 'inherit',
          background: joined ? 'transparent' : MR_PALETTE.copper,
          color: joined ? MR_PALETTE.copper : '#1A0E03',
          border: `1px solid ${MR_PALETTE.copper}`,
          cursor: 'pointer',
        }}>{joined ? 'Joined' : 'Join'}</button>
      </div>

      {/* messages */}
      <div ref={ref} className="scroll" style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', margin: '6px 0 12px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: MR_PALETTE.faint }}>
            TODAY · 10:14 PM
          </span>
        </div>
        {withMeta.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            {m.showName && (
              <button onClick={() => onOpenMember && onOpenMember(m)} style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: MR_PALETTE.muted, paddingLeft: 44, marginBottom: 2,
                background: 'transparent', border: 0, cursor: 'pointer', alignSelf: 'flex-start',
                fontFamily: 'inherit',
              }}>{m.from}{m.verified && ' ✓'}</button>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
              {!m.mine && (
                <div style={{ width: 32, height: 32, flexShrink: 0 }}>
                  {m.showName ? <PulsingAvatar name={m.from} size={32} verified={m.verified} /> : <div style={{ width: 32 }} />}
                </div>
              )}
              <div style={{
                maxWidth: '72%', padding: '8px 13px',
                background: m.mine ? `linear-gradient(135deg, ${MR_PALETTE.copper}, ${MR_PALETTE.rust})` : MR_PALETTE.elevated,
                color: m.mine ? '#1A0E03' : MR_PALETTE.text,
                border: m.mine ? 0 : `1px solid ${MR_PALETTE.border}`,
                borderRadius: m.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                fontSize: 14, lineHeight: 1.4, fontWeight: m.mine ? 500 : 400,
              }}>
                {m.text}
                <div style={{ fontSize: 9.5, marginTop: 3, opacity: .55, fontFamily: 'ui-monospace, monospace', color: m.mine ? '#1A0E03' : MR_PALETTE.muted }}>
                  {m.time}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* composer */}
      <div style={{ padding: '10px 12px 38px', background: 'rgba(13,10,6,.92)', borderTop: `1px solid ${MR_PALETTE.border}`, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: MR_PALETTE.elevated, border: `1px solid ${MR_PALETTE.border}`, borderRadius: 999, padding: '6px 6px 6px 16px' }}>
          <input
            value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Say something to the room…"
            style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: MR_PALETTE.text, fontSize: 14, fontFamily: 'inherit', padding: '6px 0' }}
          />
          <button onClick={send} style={{
            width: 36, height: 36, borderRadius: 999, border: 0, cursor: 'pointer',
            background: MR_PALETTE.copper, color: '#1A0E03', boxShadow: `0 0 16px ${MR_PALETTE.copper}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

const roomsIconBtn = (highlight) => ({
  width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer',
  background: highlight ? `${MR_PALETTE.copper}22` : 'transparent',
  color: highlight ? MR_PALETTE.copper : MR_PALETTE.text,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

Object.assign(window, { RoomsListScreen, RoomChatScreen, RoomRow, RoomGlyph, CreateRoomSheet, MR_ROOMS });
