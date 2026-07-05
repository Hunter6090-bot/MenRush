// MenRush — screens (Discover, ProfileDrawer, ChatThread, PremiumGate).
// Uses globals: PulsingAvatar, StatusBadge, VerifiedBadge, DistancePill, TribePill,
// PulseFab, Button, MessageBubble, BottomNav, TopBar, Scrim, Icon, MR_PALETTE

const MR_USERS = [
  { id: 'm', name: 'Marcus', age: 32, distMi: 0.4, online: true,  verified: true,  pulsing: true,
    bio: 'Cigar bar regular. East Village. Top.',
    tribes: ['Bear', 'Leather'], mood: 'NSA', lastMsg: 'Saw your pulse. Where are you?' },
  { id: 'd', name: 'Dane', age: 28, distMi: 2.1, online: true,  verified: false, pulsing: false,
    bio: 'New in town. Looking for tonight.',
    tribes: ['Jock', 'Otter'], mood: 'Drinks' },
  { id: 'r', name: 'Reyes', age: 41, distMi: 0.8, online: true,  verified: true,  pulsing: true,
    bio: 'Daddy. Industrial. No timewasters.',
    tribes: ['Daddy', 'Leather'], mood: 'Hookup' },
  { id: 'j', name: 'Joaquin', age: 36, distMi: 1.6, online: false, verified: true,  pulsing: false,
    bio: 'Mexican-Italian. Tattoos and tequila.', lastSeen: '12m',
    tribes: ['Bear'], mood: 'Date' },
  { id: 't', name: 'Theo', age: 26, distMi: 3.4, online: false, verified: false, pulsing: false,
    bio: 'Yoga + black coffee. Bottom.', lastSeen: '1h',
    tribes: ['Twink'], mood: 'Chat' },
  { id: 'k', name: 'Kavi', age: 38, distMi: 4.9, online: true,  verified: true,  pulsing: false,
    bio: 'British. In NYC for the week.',
    tribes: ['Otter'], mood: 'Drinks' },
];

// ── Discover (the home screen) ───────────────────────────────
function DiscoverScreen({ onOpenUser, onOpenPremium, onOpenFilters, radius, setRadius, pulsing, setPulsing }) {
  const [sort, setSort] = React.useState('Distance');
  const sorted = [...MR_USERS].sort((a, b) =>
    sort === 'Distance' ? a.distMi - b.distMi
    : sort === 'Active' ? (b.pulsing - a.pulsing) || (b.online - a.online) || (a.distMi - b.distMi)
    : a.age - b.age);
  const visible = sorted.filter(u => u.distMi <= radius);
  const onlineCount = visible.filter(u => u.online).length;
  const pulseCount = visible.filter(u => u.pulsing).length;
  const [mapOpen, setMapOpen] = React.useState(() => localStorage.getItem('mr-map-open') !== '0');
  const toggleMap = () => setMapOpen(o => { localStorage.setItem('mr-map-open', o ? '0' : '1'); return !o; });

  const mapToggleBtn = (dir, pos) => (
    <button onClick={toggleMap} title={dir === 'up' ? 'Hide map' : 'Show map'} style={{
      position: 'absolute', ...pos, zIndex: 6,
      width: 26, height: 26, borderRadius: 999, border: `1px solid ${MR_PALETTE.border}`,
      background: 'rgba(13,10,6,.7)', backdropFilter: 'blur(10px)', color: MR_PALETTE.copper,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'up' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
      </svg>
    </button>
  );

  return (
    <div className="scroll" style={{ flex: 1, paddingBottom: 96, overflowY: 'auto' }}>
      <TopBar
        title="MENRUSH"
        subtitle={`${onlineCount} active · ${pulseCount} pulsing in ${radius} mi`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onOpenPremium} style={iconBtn(true)} title="Premium">
              <Icon name="sparkle" size={18} strokeWidth={2.2} />
            </button>
            <button onClick={onOpenFilters} style={iconBtn()} title="Filters">
              <Icon name="filter" size={18} strokeWidth={2} />
            </button>
          </div>
        }
      />

      {/* Mini map / radar — collapsible */}
      <div style={{ position: 'relative' }}>
      <div style={{ height: mapOpen ? 200 : 0, overflow: 'hidden', transition: 'height .35s cubic-bezier(.16,1,.3,1)' }}>
      <div style={{ position: 'relative', height: 200, overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 50%, rgba(196,131,42,.08), transparent 60%), linear-gradient(180deg, #1A1106, #0D0A06)',
        borderBottom: `1px solid ${MR_PALETTE.border}`,
      }}>
        {/* grid */}
        <div style={{
          position: 'absolute', inset: -20,
          backgroundImage: `linear-gradient(rgba(61,43,14,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(61,43,14,.35) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
        }} />
        {/* concentric range rings */}
        {[80, 140, 200].map(r => (
          <div key={r} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: r, height: r, marginLeft: -r/2, marginTop: -r/2,
            borderRadius: '50%', border: `1px dashed ${MR_PALETTE.copper}33`,
          }} />
        ))}
        {/* self pin */}
        <div style={pin('50%', '50%', 24)}>
          <span className="radar-mini r1" style={{ width: 24, height: 24, top: 0, left: 0 }} />
          <span className="radar-mini r2" style={{ width: 24, height: 24, top: 0, left: 0 }} />
          <span className="radar-mini r3" style={{ width: 24, height: 24, top: 0, left: 0 }} />
          <span style={{
            width: 14, height: 14, borderRadius: '50%', background: MR_PALETTE.copper,
            border: `2.5px solid ${MR_PALETTE.text}`, boxShadow: `0 0 18px ${MR_PALETTE.copper}cc`,
            position: 'absolute', top: 5, left: 5, zIndex: 2,
          }} />
        </div>
        {/* other pins */}
        {visible.slice(0, 5).map((u, i) => (
          <div key={u.id} onClick={() => onOpenUser(u)} style={{
            ...pin(`${[28, 70, 65, 38, 76][i]}%`, `${[38, 30, 72, 78, 60][i]}%`, 36),
            cursor: 'pointer',
          }}>
            <PulsingAvatar name={u.name} pulsing={u.pulsing} verified={u.verified} size={36} />
          </div>
        ))}
        {/* radius selector pill */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
          {[1, 5, 25].map(r => (
            <button key={r} onClick={() => setRadius(r)} style={{
              padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: radius === r ? MR_PALETTE.copper : 'rgba(13,10,6,.7)',
              color: radius === r ? '#1A0E03' : MR_PALETTE.text,
              border: `1px solid ${radius === r ? 'transparent' : MR_PALETTE.border}`,
              backdropFilter: 'blur(10px)', cursor: 'pointer', fontFamily: 'inherit',
            }}>{r} MI</button>
          ))}
        </div>
        {/* corner label */}
        <div style={{
          position: 'absolute', bottom: 10, left: 14,
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', color: MR_PALETTE.muted,
        }}>● LIVE · {visible.length} IN RANGE</div>
        {mapToggleBtn('up', { bottom: 8, right: 10 })}
      </div>
      </div>
      {!mapOpen && mapToggleBtn('down', { top: 6, right: 10 })}
      </div>

      {/* Section header */}
      <div style={{ padding: '18px 16px 10px', paddingRight: mapOpen ? 16 : 48, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: MR_PALETTE.text, letterSpacing: '-0.005em' }}>
          {visible.length} men nearby
        </h2>
        <button onClick={() => setSort(s => s === 'Distance' ? 'Active' : s === 'Active' ? 'Age' : 'Distance')} style={{
          background: 'transparent', border: 0, color: MR_PALETTE.copper,
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
        }}>Sort · {sort}</button>
      </div>

      {/* Grid */}
      <div style={{
        padding: '0 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
      }}>
        {visible.map(u => <UserCard key={u.id} user={u} onClick={() => onOpenUser(u)} />)}
      </div>

      <div style={{ height: 30 }} />
    </div>
  );
}

const iconBtn = (highlight) => ({
  width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer',
  background: highlight ? `${MR_PALETTE.copper}22` : 'transparent',
  color: highlight ? MR_PALETTE.copper : MR_PALETTE.text,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const pin = (left, top, size) => ({
  position: 'absolute', left, top, width: size, height: size,
  transform: 'translate(-50%, -50%)', zIndex: 5,
});

// ── User card on the grid ────────────────────────────────────
function UserCard({ user, onClick }) {
  const photoBg = 'linear-gradient(160deg, #3D2B0E 0%, #1E1508 70%)';
  return (
    <button onClick={onClick} style={{
      background: MR_PALETTE.card, border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 14, overflow: 'hidden', padding: 0, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', textAlign: 'left',
      boxShadow: '0 4px 16px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,200,130,.06)',
      fontFamily: 'inherit', color: 'inherit',
    }}>
      <div style={{ aspectRatio: '3/4', background: photoBg, position: 'relative' }}>
        {/* placeholder silhouette */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(196,131,42,.1)' }}>
          <Icon name="user" size={44} strokeWidth={1.5} />
        </div>
        {/* top badges */}
        <div style={{ position: 'absolute', top: 6, left: 6, right: 6, display: 'flex', justifyContent: 'space-between', gap: 4, overflow: 'hidden' }}>
          <StatusBadge pulsing={user.pulsing} online={user.online} lastSeen={user.lastSeen} size="xs" dotOnly={true} />
          <DistancePill mi={user.distMi} size="xs" />
        </div>
        {user.verified && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6, width: 20, height: 20, borderRadius: '50%',
            background: MR_PALETTE.copper, border: `2px solid ${MR_PALETTE.card}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 12px ${MR_PALETTE.copper}88`,
          }}>
            <Icon name="check" size={10} strokeWidth={3} style={{ color: '#1A0E03' }} />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${MR_PALETTE.card} 0%, transparent 35%)` }} />
      </div>
      <div style={{ padding: '8px 9px 10px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: MR_PALETTE.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.name}
          <span style={{ color: MR_PALETTE.muted, fontWeight: 400, marginLeft: 4 }}>{user.age}</span>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
          {user.tribes.slice(0, 2).map(t => (
            <span key={t} style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 999,
              background: 'rgba(196,131,42,.1)', color: MR_PALETTE.copper,
              border: `1px solid ${MR_PALETTE.copper}33`,
            }}>{t}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ── Profile drawer (bottom sheet) ────────────────────────────
function ProfileDrawer({ user, onClose, onOpenChat, onVideoCall }) {
  const [flagged, setFlagged] = React.useState(null); // 'blocked' | 'reported'
  if (!user) return null;
  return (
    <Scrim onClose={onClose}>
      <div style={{
        background: MR_PALETTE.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderTop: `1px solid ${MR_PALETTE.border}`,
        boxShadow: '0 -24px 64px rgba(0,0,0,.7)',
        maxHeight: '90%', overflowY: 'auto',
        animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
        paddingBottom: 24,
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <span style={{ width: 36, height: 4, borderRadius: 2, background: MR_PALETTE.border }} />
        </div>

        {/* hero */}
        <div style={{
          height: 240, margin: '12px 16px 0', borderRadius: 18, overflow: 'hidden',
          background: 'linear-gradient(160deg, #3D2B0E 0%, #1E1508 80%)',
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: 'rgba(196,131,42,.15)' }}>
            <Icon name="user" size={120} strokeWidth={1.4} />
          </div>
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            width: 36, height: 36, borderRadius: 999,
            background: 'rgba(13,10,6,.7)', backdropFilter: 'blur(10px)',
            border: `1px solid ${MR_PALETTE.border}`, color: MR_PALETTE.text, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="x" size={18} strokeWidth={2.2} />
          </button>
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <StatusBadge pulsing={user.pulsing} online={user.online} lastSeen={user.lastSeen} />
          </div>
          <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
            <DistancePill mi={user.distMi} />
          </div>
        </div>

        {/* identity */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{
          margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: 26,
              letterSpacing: '0.06em', textTransform: 'uppercase', color: MR_PALETTE.text,
            }}>{user.name}</h2>
            <span style={{ fontSize: 18, color: MR_PALETTE.muted, fontWeight: 400 }}>{user.age}</span>
            {user.verified && <VerifiedBadge />}
          </div>
          <p style={{ fontSize: 15, color: MR_PALETTE.text, opacity: .85, lineHeight: 1.5, marginTop: 8, marginBottom: 0 }}>
            {user.bio}
          </p>
        </div>

        {/* meta */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0', flexWrap: 'wrap' }}>
          {user.tribes.map(t => <span key={t} style={tribeChip}>{t}</span>)}
          <span style={{ ...tribeChip, background: 'rgba(212,162,76,.12)', color: MR_PALETTE.warning, borderColor: 'rgba(212,162,76,.35)' }}>
            ↦ {user.mood}
          </span>
        </div>

        {/* stats */}
        <div style={{
          margin: '20px 20px 0', padding: '14px 16px',
          background: MR_PALETTE.elevated, borderRadius: 14, border: `1px solid ${MR_PALETTE.border}`,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
        }}>
          {[
            ['Height', '6\'1"'],
            ['Body', 'Muscular'],
            ['Position', 'Top'],
          ].map(([k,v]) => (
            <div key={k}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', color: MR_PALETTE.muted, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: MR_PALETTE.text, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* actions */}
        <div style={{ padding: '20px 20px 0', display: 'flex', gap: 10 }}>
          <Button variant="primary" full size="lg" onClick={() => onOpenChat(user)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon name="chat" size={16} strokeWidth={2.2} /> OPEN CHAT
            </span>
          </Button>
          <button onClick={() => onVideoCall && onVideoCall(user)} title="Video call" style={{
            width: 50, height: 50, borderRadius: 999,
            background: 'transparent', border: `1px solid ${MR_PALETTE.border}`,
            color: MR_PALETTE.text, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="video" size={20} strokeWidth={2} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 12 }}>
          {flagged ? (
            <span style={{ fontSize: 11.5, color: MR_PALETTE.copper, letterSpacing: '0.04em' }}>
              {flagged === 'blocked' ? 'Blocked. They can\u2019t see or message you.' : 'Reported. We\u2019ll review within 24h.'}
            </span>
          ) : (
            <React.Fragment>
              <button onClick={() => { setFlagged('blocked'); setTimeout(onClose, 1200); }} style={{
                background: 'transparent', border: 0, color: MR_PALETTE.faint,
                fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.04em',
              }}>Block</button>
              <span style={{ color: MR_PALETTE.faint, fontSize: 11.5 }}>·</span>
              <button onClick={() => { setFlagged('reported'); setTimeout(onClose, 1200); }} style={{
                background: 'transparent', border: 0, color: MR_PALETTE.faint,
                fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.04em',
              }}>Report</button>
            </React.Fragment>
          )}
        </div>
      </div>
    </Scrim>
  );
}
const tribeChip = {
  padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
  background: 'rgba(196,131,42,.1)', color: MR_PALETTE.copper,
  border: `1px solid ${MR_PALETTE.copper}40`,
};

// ── Chat thread ──────────────────────────────────────────────
function ChatScreen({ user, onBack, onOpenUser, premium = false }) {
  const [messages, setMessages] = React.useState([
    { mine: false, text: 'Saw your pulse. Where are you?', time: '9:42 PM' },
    { mine: true,  text: 'Stonewall. Back patio.',          time: '9:43 PM', seen: true },
    { mine: false, text: 'On my way. 5 min.',               time: '9:43 PM' },
    { mine: false, voice: { dur: '0:09' },                  time: '9:44 PM' },
    { mine: false, video: { dur: '0:15' },                  time: '9:45 PM' },
  ]);
  const [draft, setDraft] = React.useState('');
  const [attach, setAttach] = React.useState(null); // null | { viewOnce: boolean }
  const [gate, setGate] = React.useState(null);     // null | premium-gate variant
  const [calling, setCalling] = React.useState(false);
  const scrollRef = React.useRef(null);

  const scrollDown = () => setTimeout(() => {
    scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight);
  }, 50);

  const send = () => {
    if (attach) {
      setMessages(m => [...m, { mine: true, img: { viewOnce: attach.viewOnce, viewed: false }, time: 'now', seen: false }]);
      setAttach(null);
      scrollDown();
      if (!draft.trim()) return;
    }
    if (!draft.trim()) return;
    setMessages(m => [...m, { mine: true, text: draft.trim(), time: 'now', seen: false }]);
    setDraft('');
    scrollDown();
  };

  const openImage = (i) => {
    setMessages(m => m.map((msg, idx) => idx === i && msg.img ? { ...msg, img: { ...msg.img, viewed: true } } : msg));
  };

  const sendVoice = () => {
    setMessages(m => [...m, { mine: true, voice: { dur: '0:11' }, time: 'now', seen: false }]);
    scrollDown();
  };
  const sendVideo = () => {
    setMessages(m => [...m, { mine: true, video: { dur: '0:08' }, time: 'now', seen: false }]);
    scrollDown();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: MR_PALETTE.bg, zIndex: 40 }}>
      <TopBar
        left={<button onClick={onBack} style={iconBtn()}><Icon name="chevron-left" size={22} strokeWidth={2.2} /></button>}
        right={<div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => premium ? setCalling(true) : setGate('video-call')} title="Video call" style={iconBtn()}>
            <Icon name="video" size={20} strokeWidth={1.8} style={{ color: MR_PALETTE.copper }} />
          </button>
          <MoreMenu style={iconBtn()} items={[
          { label: 'View profile', onClick: () => onOpenUser(user) },
          { label: 'Mute notifications' },
          { label: 'Report', danger: true },
          { label: 'Block', danger: true },
        ]} />
        </div>}
      />
      {/* identity strip */}
      <button onClick={() => onOpenUser(user)} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: MR_PALETTE.card, borderBottom: `1px solid ${MR_PALETTE.border}`,
        border: 'none', width: '100%', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', textAlign: 'left',
      }}>
        <PulsingAvatar name={user.name} pulsing={user.pulsing} verified={user.verified} size={42} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: MR_PALETTE.text }}>{user.name}</span>
            <span style={{ color: MR_PALETTE.muted, fontSize: 13 }}>{user.age}</span>
          </div>
          <div style={{ fontSize: 11, color: user.online ? MR_PALETTE.online : MR_PALETTE.muted, marginTop: 1 }}>
            {user.pulsing ? 'Pulsing now' : user.online ? 'Active now' : `Last seen ${user.lastSeen}`} · {user.distMi < 1 ? `${Math.round(user.distMi*1760)} yd` : `${user.distMi.toFixed(1)} mi`}
          </div>
        </div>
        <Icon name="chevron-down" size={18} strokeWidth={2} style={{ color: MR_PALETTE.muted, transform: 'rotate(-90deg)' }} />
      </button>

      {/* messages */}
      <div ref={scrollRef} className="scroll" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', margin: '6px 0 14px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: MR_PALETTE.faint }}>
            TODAY · 9:42 PM
          </span>
        </div>
        {messages.map((m, i) => (
          m.voice
            ? <VoiceBubble key={i} mine={m.mine} dur={m.voice.dur} time={m.time} />
            : m.video
            ? <VideoBubble key={i} mine={m.mine} dur={m.video.dur} time={m.time}
                locked={!premium && !m.mine} onLockedTap={() => setGate('video-note')} />
            : m.img
            ? <ImageBubble key={i} mine={m.mine} img={m.img} time={m.time} onOpen={() => openImage(i)} />
            : <MessageBubble key={i} mine={m.mine} time={m.time} seen={m.seen}>{m.text}</MessageBubble>
        ))}
        {!premium && (
          <button onClick={() => setGate('video-note')} style={{
            margin: '2px auto 0', background: 'transparent', border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 10.5, color: MR_PALETTE.faint, letterSpacing: '0.04em',
          }}>
            Video notes are for <span style={{ color: MR_PALETTE.copper, fontWeight: 700 }}>Premium</span> members — upgrade to watch
          </button>
        )}
      </div>

      {/* composer */}
      <div style={{
        padding: '10px 12px 38px', background: 'rgba(13,10,6,.92)',
        borderTop: `1px solid ${MR_PALETTE.border}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {attach && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: MR_PALETTE.elevated, border: `1px solid ${MR_PALETTE.border}`,
            borderRadius: 12, padding: '8px 10px',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(160deg, #3D2B0E, #1E1508)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(196,131,42,.5)',
            }}><Icon name="image" size={20} strokeWidth={1.6} /></div>
            <div style={{ flex: 1, fontSize: 12, color: MR_PALETTE.muted }}>Photo ready</div>
            <button onClick={() => setAttach(a => ({ viewOnce: !a.viewOnce }))} style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              fontFamily: 'inherit', cursor: 'pointer',
              background: attach.viewOnce ? MR_PALETTE.copper : 'transparent',
              color: attach.viewOnce ? '#1A0E03' : MR_PALETTE.muted,
              border: `1px solid ${attach.viewOnce ? 'transparent' : MR_PALETTE.border}`,
            }}>① VIEW ONCE</button>
            <button onClick={() => setAttach(null)} style={{
              width: 28, height: 28, borderRadius: 999, border: 0, cursor: 'pointer',
              background: 'transparent', color: MR_PALETTE.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="x" size={16} strokeWidth={2.2} /></button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => setAttach(a => a || { viewOnce: false })} title="Camera" style={{
          width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
          background: 'transparent', color: MR_PALETTE.copper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="camera" size={19} strokeWidth={1.8} /></button>
        <button onClick={() => setAttach(a => a || { viewOnce: false })} title="Attach photo" style={{
          width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
          background: 'transparent', color: MR_PALETTE.copper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="image" size={19} strokeWidth={1.8} /></button>
        <button onClick={() => premium ? sendVoice() : setGate('media')} title="Voice note" style={{
          width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
          background: 'transparent', color: MR_PALETTE.copper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="mic" size={19} strokeWidth={1.8} /></button>
        <button onClick={() => premium ? sendVideo() : setGate('media')} title="Video note" style={{
          width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
          background: 'transparent', color: MR_PALETTE.copper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="video" size={19} strokeWidth={1.8} /></button>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: MR_PALETTE.elevated, border: `1px solid ${MR_PALETTE.border}`,
          borderRadius: 999, padding: '6px 6px 6px 18px',
        }}>
          <input
            value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Say something direct…"
            style={{
              flex: 1, background: 'transparent', border: 0, outline: 'none',
              color: MR_PALETTE.text, fontSize: 14, fontFamily: 'inherit', padding: '6px 0',
            }}
          />
          <button onClick={send} style={{
            width: 36, height: 36, borderRadius: 999, border: 0, cursor: 'pointer',
            background: MR_PALETTE.copper, color: '#1A0E03',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 16px ${MR_PALETTE.copper}66`,
          }}>
            <Icon name="send" size={16} />
          </button>
        </div>
        </div>
      </div>
      {gate && <window.PremiumGate variant={gate} onClose={() => setGate(null)} />}
      {calling && <window.VideoCallModal user={user} state="active" onClose={() => setCalling(false)} onHangup={() => setCalling(false)} />}
    </div>
  );
}

// ── Voice note bubble — waveform + play, audible for everyone ──
const MR_WAVE = [5, 9, 14, 8, 12, 16, 10, 6, 11, 15, 9, 5, 8, 13, 7, 10, 14, 6, 9, 12];
function VoiceBubble({ mine, dur = '0:12', time }) {
  const [playing, setPlaying] = React.useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', maxWidth: '75%',
        background: mine ? 'linear-gradient(135deg, #C4832A, #8B4513)' : MR_PALETTE.elevated,
        border: mine ? 'none' : `1px solid ${MR_PALETTE.border}`,
        borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      }}>
        <button onClick={() => setPlaying(p => !p)} title={playing ? 'Pause' : 'Play'} style={{
          width: 30, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
          background: mine ? 'rgba(26,14,3,.85)' : MR_PALETTE.copper,
          color: mine ? MR_PALETTE.copper : '#1A0E03',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={playing ? 'pause' : 'play'} size={13} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 18 }}>
          {MR_WAVE.map((h, i) => (
            <span key={i} style={{
              width: 2.5, height: h, borderRadius: 2,
              background: mine ? 'rgba(26,14,3,.7)' : `${MR_PALETTE.copper}cc`,
            }} />
          ))}
        </div>
        <span style={{
          fontSize: 10.5, fontFamily: 'ui-monospace, monospace',
          color: mine ? 'rgba(26,14,3,.7)' : MR_PALETTE.muted, flexShrink: 0,
        }}>{dur} · {time}</span>
      </div>
    </div>
  );
}

// ── Video note bubble — premium plays; non-premium sees blur + logo ──
function VideoBubble({ mine, dur = '0:15', time, locked, onLockedTap }) {
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        onClick={() => locked && onLockedTap && onLockedTap()}
        style={{
          width: 160, height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
          background: 'linear-gradient(160deg, #3D2B0E, #1E1508)',
          border: `1px solid ${mine ? `${MR_PALETTE.copper}55` : MR_PALETTE.border}`,
          cursor: locked ? 'pointer' : 'default',
        }}>
        {locked ? (
          <React.Fragment>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 40% 30%, #6B4A16, #241804 70%)',
              filter: 'blur(14px)', transform: 'scale(1.2)',
            }} />
            <img src="../../assets/menrush-logo.png" alt="" draggable="false" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
              opacity: .28, padding: 26, boxSizing: 'border-box',
            }} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14, gap: 6,
            }}>
              <span style={{
                width: 34, height: 34, borderRadius: 999, background: 'rgba(13,10,6,.75)',
                border: `1px solid ${MR_PALETTE.copper}88`, color: MR_PALETTE.copper,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name="lock" size={15} strokeWidth={2} /></span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: MR_PALETTE.copper,
                textShadow: '0 1px 6px rgba(0,0,0,.8)',
              }}>VIDEO · PREMIUM ONLY</span>
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{
                width: 44, height: 44, borderRadius: 999, background: 'rgba(13,10,6,.6)',
                border: `1.5px solid ${MR_PALETTE.copper}`, color: MR_PALETTE.copper,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name="play" size={16} /></span>
            </div>
            <div style={{
              position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(13,10,6,.75)', color: MR_PALETTE.copper,
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              display: 'inline-flex', gap: 4, alignItems: 'center',
            }}><Icon name="video" size={10} strokeWidth={2} /> {dur}</div>
            <div style={{ position: 'absolute', bottom: 6, right: 10, fontSize: 9.5, color: 'rgba(240,224,192,.65)' }}>{time}</div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

// ── Image bubble — normal or view-once ────────────────────
function ImageBubble({ mine, img, time, onOpen }) {
  const locked = img.viewOnce && img.viewed;
  const hidden = img.viewOnce && !img.viewed;
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        onClick={() => hidden && onOpen()}
        style={{
          width: 160, height: locked ? 56 : 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
          background: locked ? MR_PALETTE.elevated : 'linear-gradient(160deg, #3D2B0E, #1E1508)',
          border: `1px solid ${mine ? `${MR_PALETTE.copper}55` : MR_PALETTE.border}`,
          cursor: hidden ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6,
        }}>
        {locked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MR_PALETTE.faint, fontSize: 11, fontWeight: 600 }}>
            ① Opened · expired
          </div>
        ) : hidden ? (
          <React.Fragment>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: `${MR_PALETTE.copper}22`,
              border: `1.5px solid ${MR_PALETTE.copper}`, color: MR_PALETTE.copper,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
            }}>①</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: MR_PALETTE.copper }}>TAP TO VIEW ONCE</div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(196,131,42,.18)' }}>
              <Icon name="image" size={48} strokeWidth={1.2} />
            </div>
            {img.viewOnce && (
              <div style={{
                position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 999,
                background: 'rgba(13,10,6,.75)', color: MR_PALETTE.copper,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              }}>① VIEW ONCE</div>
            )}
            <div style={{ position: 'absolute', bottom: 6, right: 10, fontSize: 9.5, color: 'rgba(240,224,192,.65)' }}>{time}</div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

// ── Premium gate modal ───────────────────────────────────────
function PremiumGate({ onClose }) {
  return (
    <Scrim onClose={onClose} style={{ alignItems: 'center', padding: 16 }}>
      <div style={{
        background: MR_PALETTE.card, borderRadius: 20,
        border: `1px solid ${MR_PALETTE.copper}50`,
        boxShadow: `0 24px 80px rgba(0,0,0,.85), 0 0 60px ${MR_PALETTE.copper}33`,
        animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
        margin: '0 auto', maxWidth: 400,
      }}>
        {/* hero */}
        <div style={{
          padding: '28px 24px 18px', textAlign: 'center', position: 'relative',
          borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'url(../../assets/menrush-logo.png)',
            backgroundSize: '260px', backgroundPosition: 'center 30%', backgroundRepeat: 'no-repeat',
            opacity: .16, pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', color: MR_PALETTE.copper }}>
              MENRUSH PREMIUM
            </div>
            <h2 style={{
              margin: '12px 0 4px', fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 900,
              letterSpacing: '0.06em', textTransform: 'uppercase', color: MR_PALETTE.text,
            }}>3 men liked you.</h2>
            <p style={{ fontSize: 13, color: MR_PALETTE.muted, margin: 0 }}>See them. Open chat. Skip the queue.</p>
          </div>
        </div>
        {/* perks */}
        <div style={{ padding: '4px 24px 22px' }}>
          {[
            'See who liked you',
            'Expand radius to 30 miles',
            'Message without matching',
            'Boost — top of nearby for 30 min',
            'Incognito · advanced filters',
          ].map(perk => (
            <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14, color: MR_PALETTE.text }}>
              <Icon name="check" size={16} strokeWidth={2.4} style={{ color: MR_PALETTE.copper, flexShrink: 0 }} />
              {perk}
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" full size="lg" onClick={onClose}>UNLOCK · $9.99/MO</Button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: MR_PALETTE.faint, marginTop: 12 }}>
            Cancel anytime.
          </p>
        </div>
      </div>
    </Scrim>
  );
}

Object.assign(window, {
  DiscoverScreen, ProfileDrawer, ChatScreen, UserCard, MR_USERS,
  VoiceBubble, VideoBubble, ImageBubble,
});
