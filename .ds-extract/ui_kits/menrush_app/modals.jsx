// MenRush — modals & sheets (unified PremiumGate, VideoCall, Boost, Incognito, Mood/Tribe sheet)
// Globals used: MR_PALETTE, Icon, Scrim, Button, PulsingAvatar, TribePill

// ────────────────────────────────────────────────────────────
// Unified PremiumGate — all paywalls share this pattern.
// One copper CTA, no scarcity timers, single layout.
// variant: 'likes' | 'boost' | 'incognito' | 'radius' | 'filters'
// ────────────────────────────────────────────────────────────
const PREMIUM_VARIANTS = {
  likes: {
    eyebrow: 'MENRUSH PREMIUM',
    title: '3 men liked you.',
    sub: 'See them. Open chat. Skip the queue.',
    perks: [
      'See who liked you',
      'Expand radius to 30 miles',
      'Message without matching',
      'Boost — top of nearby for 30 minutes',
      'Incognito · advanced filters',
    ],
    cta: 'UNLOCK · £9.99/MO',
  },
  boost: {
    eyebrow: 'BOOST',
    title: 'Top of nearby. 30 minutes.',
    sub: 'Push your card to the top for every man in your radius.',
    perks: [
      'First in the grid for 30 minutes',
      'Pulsing copper border on your card',
      'More profile views while boosted',
      'One-tap activate, no auto-renew',
    ],
    cta: 'BOOST NOW · £4.99',
  },
  incognito: {
    eyebrow: 'INCOGNITO',
    title: 'Browse without being seen.',
    sub: 'See nearby men. They won\'t see you until you pulse.',
    perks: [
      'Hide from the discovery grid',
      'No "active now" status leak',
      'Still receive messages from matches',
      'Toggle on or off any time',
    ],
    cta: 'GO INVISIBLE · £4.99/MO',
    bundle: true,
  },
  radius: {
    eyebrow: 'EXPANDED RADIUS',
    title: 'See further than 3 miles.',
    sub: 'Push your discovery range up to 30 miles — useful when you\'re travelling.',
    perks: [
      'Set radius up to 30 miles',
      'Filter by city when away from home',
      'Pin a custom location',
      'Save up to 5 radius presets',
    ],
    cta: 'EXPAND · £6.99/MO',
    bundle: true,
  },
  filters: {
    eyebrow: 'ADVANCED FILTERS',
    title: 'Narrow it down.',
    sub: 'Filter the grid by tribe, ethnicity, body type, height, position, and what they\'re here for.',
    perks: [
      'Filter by 14 tribe tags',
      'Ethnicity · body type · height · position',
      'Mood · "here for" intent',
      'Verified-only mode',
    ],
    cta: 'UNLOCK FILTERS · £6.99/MO',
    bundle: true,
  },
  media: {
    eyebrow: 'VOICE & VIDEO NOTES',
    title: 'Say it. Show it.',
    sub: 'Record voice and video notes straight from any chat. Everyone hears your voice notes — video notes are premium on both ends.',
    perks: [
      'Record & send voice notes',
      'Record & send video notes',
      'Watch every video note you receive',
      'Unlimited 1:1 video calls',
    ],
    cta: 'UNLOCK · £9.99/MO',
    bundle: true,
  },
  'video-note': {
    eyebrow: 'VIDEO NOTES',
    title: 'He sent you a video.',
    sub: 'Video notes are a premium feature. Upgrade to watch this one — and every one after it.',
    perks: [
      'Watch every video note you receive',
      'Record & send your own',
      'Unlimited 1:1 video calls',
    ],
    cta: 'UNLOCK · £9.99/MO',
    bundle: true,
  },
  'video-call': {
    eyebrow: 'VIDEO CALLS',
    title: 'Face to face. Now.',
    sub: 'Video calls are premium-only. Upgrade to call any man in your chats.',
    perks: [
      'Unlimited 1:1 video calls',
      'Voice & video notes',
      'Message without matching',
    ],
    cta: 'UNLOCK · £9.99/MO',
    bundle: true,
  },
};

function PremiumGate({ variant = 'likes', onClose }) {
  const v = PREMIUM_VARIANTS[variant] || PREMIUM_VARIANTS.likes;
  return (
    <Scrim onClose={onClose} style={{ alignItems: 'center', padding: 16 }}>
      <div style={{
        background: MR_PALETTE.card, borderRadius: 20,
        border: `1px solid ${MR_PALETTE.copper}50`,
        boxShadow: `0 24px 80px rgba(0,0,0,.85), 0 0 60px ${MR_PALETTE.copper}33`,
        animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
        margin: '0 auto', maxWidth: 400, position: 'relative',
      }}>
        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 12, right: 12, zIndex: 5,
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(13,10,6,.5)', border: `1px solid ${MR_PALETTE.border}`,
          color: MR_PALETTE.muted, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="x" size={14} strokeWidth={2.2} />
        </button>
        {/* hero with medallion reverse */}
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
              {v.eyebrow}
            </div>
            <h2 style={{
              margin: '12px 0 4px',
              fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 900,
              letterSpacing: '0.04em', textTransform: 'uppercase', color: MR_PALETTE.text,
              textWrap: 'balance',
            }}>{v.title}</h2>
            <p style={{ fontSize: 13, color: MR_PALETTE.muted, margin: 0, lineHeight: 1.45 }}>{v.sub}</p>
          </div>
        </div>
        {/* perks */}
        <div style={{ padding: '4px 24px 22px' }}>
          {v.perks.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14, color: MR_PALETTE.text }}>
              <Icon name="check" size={16} strokeWidth={2.4} style={{ color: MR_PALETTE.copper, flexShrink: 0 }} />
              {p}
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" full size="lg" onClick={onClose}>{v.cta}</Button>
          </div>
          {v.bundle && (
            <p style={{
              textAlign: 'center', fontSize: 11.5, color: MR_PALETTE.muted, marginTop: 14, lineHeight: 1.5,
              padding: '10px 12px', background: 'rgba(196,131,42,.06)',
              border: `1px solid ${MR_PALETTE.border}`, borderRadius: 10,
            }}>
              Get this plus 4 more in <b style={{ color: MR_PALETTE.copper, fontWeight: 700 }}>MenRush Premium</b> for £9.99/mo.
            </p>
          )}
          <p style={{ textAlign: 'center', fontSize: 11, color: MR_PALETTE.faint, marginTop: 12 }}>
            Cancel anytime.
          </p>
        </div>
      </div>
    </Scrim>
  );
}

// ────────────────────────────────────────────────────────────
// Boost confirmation — different from PremiumGate (this fires AFTER they pay)
// ────────────────────────────────────────────────────────────
function BoostConfirmModal({ onClose }) {
  const [remaining, setRemaining] = React.useState('29:48');
  return (
    <Scrim onClose={onClose} style={{ alignItems: 'center', padding: 16 }}>
      <div style={{
        background: MR_PALETTE.card, borderRadius: 20, maxWidth: 360, margin: '0 auto',
        border: `1px solid ${MR_PALETTE.copper}50`,
        boxShadow: `0 24px 80px rgba(0,0,0,.85), 0 0 60px ${MR_PALETTE.copper}33`,
        animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
        textAlign: 'center', padding: '28px 24px 22px',
      }}>
        {/* pulsing core glyph */}
        <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 16px' }}>
          <span style={pulseRing88(0)} />
          <span style={pulseRing88(1)} />
          <span style={{
            position: 'absolute', inset: 22, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 30px ${MR_PALETTE.copper}aa, inset 0 1px 0 rgba(255,220,170,.4)`,
            zIndex: 2,
          }}>
            <Icon name="pulse" size={22} strokeWidth={2.4} style={{ color: '#1A0E03' }} />
          </span>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', color: MR_PALETTE.copper }}>BOOSTED</div>
        <h2 style={{
          margin: '8px 0 6px',
          fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 900,
          letterSpacing: '0.04em', textTransform: 'uppercase', color: MR_PALETTE.text,
        }}>Boost active.</h2>
        <p style={{ fontSize: 13, color: MR_PALETTE.muted, margin: '0 0 18px', lineHeight: 1.5 }}>
          Your profile jumps ahead of non-boosted men in your radius for the next 30 minutes.
        </p>
        <div style={{
          padding: '12px 14px', background: MR_PALETTE.elevated, border: `1px solid ${MR_PALETTE.border}`,
          borderRadius: 12, marginBottom: 16,
        }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', color: MR_PALETTE.muted }}>REMAINING</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 28, fontWeight: 700, color: MR_PALETTE.copper, marginTop: 2 }}>
            {remaining}
          </div>
        </div>
        <Button variant="secondary" full onClick={onClose}>Got it</Button>
      </div>
    </Scrim>
  );
}
const pulseRing88 = (i) => ({
  position: 'absolute', width: 44, height: 44, top: 22, left: 22, borderRadius: '50%',
  background: MR_PALETTE.copper, opacity: i === 0 ? .5 : .3,
  animation: `nn-radar 2.4s cubic-bezier(.16,1,.3,1) ${i * 0.8}s infinite`,
});

// ────────────────────────────────────────────────────────────
// Video call modal
// Full-screen-ish (inside device) — incoming call + active call patterns
// ────────────────────────────────────────────────────────────
function VideoCallModal({ user, state = 'incoming', onClose, onAnswer, onHangup }) {
  if (state === 'incoming') {
    return (
      <Scrim onClose={onClose} style={{ alignItems: 'stretch', padding: 0, background: 'rgba(0,0,0,.92)' }}>
        <div style={{
          minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
          padding: '60px 24px 110px', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', color: MR_PALETTE.copper, marginBottom: 14 }}>
              ● INCOMING VIDEO
            </div>
            <PulsingAvatar name={user.name} pulsing={true} verified={user.verified} size={120} />
            <h2 style={{
              marginTop: 22, fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 900,
              letterSpacing: '0.04em', textTransform: 'uppercase', color: MR_PALETTE.text,
            }}>{user.name}</h2>
            <p style={{ fontSize: 14, color: MR_PALETTE.muted, marginTop: 6 }}>
              {user.distMi < 1 ? `${Math.round(user.distMi*1760)} yd away` : `${user.distMi.toFixed(1)} mi away`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
            <CallButton kind="hangup" onClick={onHangup} />
            <CallButton kind="answer" onClick={onAnswer} />
          </div>
        </div>
      </Scrim>
    );
  }
  // active state
  const [facing, setFacing] = React.useState('front');
  return (
    <Scrim onClose={onClose} style={{ alignItems: 'stretch', padding: 0, background: '#000' }}>
      <div style={{
        position: 'relative', minHeight: '100%', overflow: 'hidden',
        background: `linear-gradient(160deg, #2A1C0A 0%, #0D0A06 80%)`,
      }}>
        {/* "their" video — placeholder */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(196,131,42,.18)',
        }}>
          <Icon name="user" size={180} strokeWidth={1.2} />
        </div>
        {/* top status row */}
        <div style={{
          position: 'absolute', top: 60, left: 16, right: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            padding: '6px 12px', borderRadius: 999,
            background: 'rgba(13,10,6,.6)', backdropFilter: 'blur(10px)',
            border: `1px solid ${MR_PALETTE.border}`,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B0432E', boxShadow: '0 0 8px #B0432E' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: MR_PALETTE.text, fontFamily: 'ui-monospace, monospace' }}>02:14</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: MR_PALETTE.text }}>{user.name}</div>
        </div>
        {/* my video — PiP: drag to move, corner grip to resize */}
        <DraggablePiP facing={facing} />
        {/* bottom controls */}
        <div style={{
          position: 'absolute', bottom: 110, left: 0, right: 0,
          display: 'flex', gap: 16, justifyContent: 'center',
        }}>
          <CallButton kind="mic" />
          <CallButton kind="camera" />
          <CallButton kind="hangup" onClick={onHangup} />
          <CallButton kind="flip" onClick={() => setFacing(f => f === 'front' ? 'back' : 'front')} />
        </div>
      </div>
    </Scrim>
  );
}

// My-video PiP — draggable anywhere, resizable from the copper corner grip
function DraggablePiP({ facing = 'front' }) {
  const RATIO = 110 / 80, MINW = 60, MAXW = 200;
  const [w, setW] = React.useState(80);
  const [pos, setPos] = React.useState(null); // null = default top-right
  const ref = React.useRef(null);

  const startDrag = (e) => {
    if (e.target.closest('[data-grip]')) return;
    e.preventDefault();
    const el = ref.current, parent = el.parentElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    el.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const rw = el.getBoundingClientRect();
      setPos({
        x: Math.max(8, Math.min(ev.clientX - parent.left - ox, parent.width - rw.width - 8)),
        y: Math.max(50, Math.min(ev.clientY - parent.top - oy, parent.height - rw.height - 8)),
      });
    };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  };
  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const grip = e.currentTarget, startW = w, sx = e.clientX;
    grip.setPointerCapture(e.pointerId);
    const mv = (ev) => setW(Math.max(MINW, Math.min(MAXW, startW + (ev.clientX - sx))));
    const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); };
    grip.addEventListener('pointermove', mv);
    grip.addEventListener('pointerup', up);
  };

  return (
    <div ref={ref} onPointerDown={startDrag} style={{
      position: 'absolute',
      ...(pos ? { left: pos.x, top: pos.y } : { top: 110, right: 16 }),
      width: w, height: Math.round(w * RATIO), borderRadius: 12,
      background: 'linear-gradient(160deg, #3D2B0E, #1E1508)',
      border: `1px solid ${MR_PALETTE.copper}55`,
      boxShadow: '0 8px 24px rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(196,131,42,.3)', cursor: 'grab', touchAction: 'none', userSelect: 'none', zIndex: 5,
    }}>
      <Icon name="user" size={Math.round(w / 2)} strokeWidth={1.4} />
      <span style={{
        position: 'absolute', top: 6, left: 8, fontSize: 8, fontWeight: 700,
        letterSpacing: '0.16em', color: MR_PALETTE.muted,
      }}>{facing.toUpperCase()}</span>
      <span data-grip onPointerDown={startResize} style={{
        position: 'absolute', right: -1, bottom: -1, width: 18, height: 18,
        borderRadius: '10px 0 11px 0', background: MR_PALETTE.copper,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'nwse-resize',
      }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1A0E03" strokeWidth="3" strokeLinecap="round"><path d="M21 15v6h-6M21 21L13 13"/></svg>
      </span>
    </div>
  );
}

function CallButton({ kind, onClick }) {
  const cfg = {
    answer:  { bg: MR_PALETTE.online, color: '#0D1A06', icon: 'video', size: 72 },
    hangup:  { bg: MR_PALETTE.danger,  color: '#fff',    icon: 'x',     size: 72 },
    mic:     { bg: 'rgba(255,255,255,.12)', color: '#fff', icon: 'mic',  size: 56 },
    camera:  { bg: 'rgba(255,255,255,.12)', color: '#fff', icon: 'video',size: 56 },
    flip:    { bg: 'rgba(255,255,255,.12)', color: '#fff', icon: 'flip', size: 56 },
  }[kind];
  return (
    <button onClick={onClick} aria-label={kind} style={{
      width: cfg.size, height: cfg.size, borderRadius: '50%',
      background: cfg.bg, color: cfg.color, border: 0, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 8px 24px rgba(0,0,0,.5)',
    }}>
      <ExtraIcon name={cfg.icon} size={cfg.size * 0.42} />
    </button>
  );
}
// extra icons for video controls
function ExtraIcon({ name, size }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'video')  return <svg {...p}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-3v10l-4-3z" fill="currentColor"/></svg>;
  if (name === 'mic')    return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 12a7 7 0 0 0 14 0M12 19v3M8 22h8"/></svg>;
  if (name === 'flip')   return <svg {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
  if (name === 'x')      return <svg {...p}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>;
  return null;
}

// ────────────────────────────────────────────────────────────
// Mood / Tribe picker — full bottom sheet
// ────────────────────────────────────────────────────────────
const TRIBES = ['Bear', 'Cub', 'Daddy', 'Jock', 'Leather', 'Otter', 'Twink', 'Wolf', 'Geek', 'Punk', 'Sub', 'Top'];
const MOODS  = ['NSA',  'Hookup', 'Date', 'Drinks', 'Chat', 'Workout', 'Long-term'];
const ETHNICITIES = ['Asian', 'Black', 'Latino', 'Middle Eastern', 'Mixed', 'Native American', 'South Asian', 'White', 'Other'];

function MoodTribeSheet({ initialTribes = [], initialMood = null, initialEthnicities = [], onClose, onSave }) {
  const [tribes, setTribes] = React.useState(initialTribes);
  const [mood,   setMood]   = React.useState(initialMood);
  const [eths,   setEths]   = React.useState(initialEthnicities);
  const toggle = (t) => setTribes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleEth = (e) => setEths(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]);

  return (
    <Scrim onClose={onClose}>
      <div style={{
        background: MR_PALETTE.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderTop: `1px solid ${MR_PALETTE.border}`,
        boxShadow: '0 -24px 64px rgba(0,0,0,.7)',
        animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
        paddingBottom: 30, maxHeight: '92%', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <span style={{ width: 36, height: 4, borderRadius: 2, background: MR_PALETTE.border }} />
        </div>
        <div style={{ padding: '14px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{
            margin: 0, fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 900,
            letterSpacing: '0.06em', textTransform: 'uppercase', color: MR_PALETTE.text,
          }}>You</h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 0, color: MR_PALETTE.muted, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13,
          }}>Cancel</button>
        </div>

        {/* ── Mood — single-select RADIO row ─────────────── */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: MR_PALETTE.muted }}>HERE FOR</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', color: MR_PALETTE.faint }}>PICK ONE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MOODS.map(m => <MoodRadio key={m} label={m} active={mood === m} onClick={() => setMood(m)} />)}
          </div>
        </div>

        {/* ── Tribes — multi-select CHIPS w/ ✓ ─────────────── */}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: MR_PALETTE.muted }}>TRIBES</span>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              padding: '3px 9px', borderRadius: 999,
              background: tribes.length === 4 ? MR_PALETTE.copper : `${MR_PALETTE.copper}1f`,
              color: tribes.length === 4 ? '#1A0E03' : MR_PALETTE.copper,
              border: tribes.length === 4 ? 0 : `1px solid ${MR_PALETTE.copper}55`,
            }}>{tribes.length} of 4 selected</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TRIBES.map(t => {
              const on = tribes.includes(t);
              const disabled = !on && tribes.length >= 4;
              return <TribeChip key={t} label={t} active={on} disabled={disabled} onClick={() => !disabled && toggle(t)} />;
            })}
          </div>
        </div>

        {/* ── Ethnicity — multi-select CHIPS ─────────────── */}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: MR_PALETTE.muted }}>ETHNICITY</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', color: MR_PALETTE.faint }}>OPTIONAL</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ETHNICITIES.map(e => (
              <TribeChip key={e} label={e} active={eths.includes(e)} onClick={() => toggleEth(e)} />
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 20px 0' }}>
          <Button variant="primary" full size="lg" onClick={() => onSave && onSave({ tribes, mood, ethnicities: eths })}>
            Save
          </Button>
        </div>
      </div>
    </Scrim>
  );
}

// ── Radio row (Mood — single-select) ─────────────────────────
function MoodRadio({ label, active, onClick }) {
  return (
    <button onClick={onClick} role="radio" aria-checked={active} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', padding: '12px 14px', borderRadius: 12,
      background: active ? `${MR_PALETTE.copper}18` : 'transparent',
      border: `1px solid ${active ? `${MR_PALETTE.copper}55` : MR_PALETTE.border}`,
      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      transition: 'background .15s, border-color .15s',
      boxShadow: active ? `inset 0 0 24px ${MR_PALETTE.copper}10` : 'none',
    }}>
      {/* radio dot */}
      <span style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${active ? MR_PALETTE.copper : MR_PALETTE.faint}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', transition: 'border-color .15s',
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: active ? MR_PALETTE.copper : 'transparent',
          boxShadow: active ? `0 0 8px ${MR_PALETTE.copper}` : 'none',
          transform: active ? 'scale(1)' : 'scale(0)',
          transition: 'transform .2s cubic-bezier(.16,1,.3,1)',
        }} />
      </span>
      <span style={{
        fontSize: 14, fontWeight: active ? 700 : 500,
        color: active ? MR_PALETTE.text : MR_PALETTE.muted,
      }}>{label}</span>
    </button>
  );
}

// ── Multi-select chip (Tribes — pick up to 4) ────────────────
function TribeChip({ label, active, disabled, onClick }) {
  return (
    <button onClick={onClick} role="checkbox" aria-checked={active} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: active ? '7px 12px 7px 9px' : '7px 14px',
      borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? MR_PALETTE.copper : 'rgba(196,131,42,.06)',
      color: active ? '#1A0E03' : (disabled ? MR_PALETTE.faint : MR_PALETTE.text),
      border: `1px solid ${active ? 'transparent' : MR_PALETTE.border}`,
      fontSize: 12, fontWeight: active ? 700 : 500,
      boxShadow: active ? `0 0 14px ${MR_PALETTE.copper}44` : 'none',
      whiteSpace: 'nowrap', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
      transition: 'background .15s, padding .15s',
    }}>
      {active && (
        <span style={{
          width: 14, height: 14, borderRadius: '50%', background: '#1A0E03',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: MR_PALETTE.copper,
        }}>
          <Icon name="check" size={9} strokeWidth={3.5} />
        </span>
      )}
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Incognito toggle — full screen (settings sub-page)
// ────────────────────────────────────────────────────────────
function IncognitoScreen({ active: initial = false, onBack }) {
  const [active, setActive] = React.useState(initial);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: MR_PALETTE.bg, zIndex: 40 }}>
      <TopBar
        left={<button onClick={onBack} style={iconBtn()}><Icon name="chevron-left" size={22} strokeWidth={2.2} /></button>}
        title="INCOGNITO"
      />
      <div style={{ flex: 1, padding: '30px 22px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* hero glyph */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div style={{
            position: 'relative', width: 96, height: 96, borderRadius: '50%',
            background: active ? `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})` : MR_PALETTE.elevated,
            border: `1px solid ${active ? 'transparent' : MR_PALETTE.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: active ? `0 0 40px ${MR_PALETTE.copper}77` : 'none',
            color: active ? '#1A0E03' : MR_PALETTE.muted,
          }}>
            <IncognitoGlyph size={44} />
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            margin: '0 0 6px', fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 900,
            letterSpacing: '0.04em', textTransform: 'uppercase', color: MR_PALETTE.text,
          }}>{active ? 'Invisible' : 'Visible'}</h2>
          <p style={{ fontSize: 14, color: MR_PALETTE.muted, margin: 0, lineHeight: 1.5 }}>
            {active
              ? "You're hidden from the discovery grid. They won't see you until you pulse."
              : "Other men in your radius can see you and message you."}
          </p>
        </div>

        {/* big toggle */}
        <div style={{
          padding: '16px 18px', background: MR_PALETTE.card,
          border: `1px solid ${active ? MR_PALETTE.copper + '55' : MR_PALETTE.border}`,
          borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: active ? `0 0 24px ${MR_PALETTE.copper}22` : 'none',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: MR_PALETTE.text }}>Incognito mode</div>
            <div style={{ fontSize: 12, color: MR_PALETTE.muted, marginTop: 2 }}>Premium feature</div>
          </div>
          <Toggle active={active} onChange={() => setActive(a => !a)} />
        </div>

        {/* rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Hidden from the grid', 'Your card doesn\'t appear in anyone\'s nearby list.'],
            ['No "active now"', 'Status flips to "Last seen 1d" for everyone.'],
            ['You still receive messages', 'Matches and existing chats keep working.'],
            ['Toggle off any time', 'You re-appear immediately. No cooldown.'],
          ].map(([t, d]) => (
            <div key={t} style={{ display: 'flex', gap: 12 }}>
              <Icon name="check" size={16} strokeWidth={2.4} style={{ color: MR_PALETTE.copper, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: MR_PALETTE.text }}>{t}</div>
                <div style={{ fontSize: 12, color: MR_PALETTE.muted, marginTop: 1 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ active, onChange }) {
  return (
    <button onClick={onChange} aria-pressed={active} style={{
      width: 52, height: 30, borderRadius: 999,
      background: active ? MR_PALETTE.copper : MR_PALETTE.border,
      border: 0, cursor: 'pointer', position: 'relative', transition: 'background .2s',
      boxShadow: active ? `0 0 16px ${MR_PALETTE.copper}88, inset 0 1px 0 rgba(255,220,170,.3)` : 'inset 0 1px 0 rgba(0,0,0,.4)',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: active ? 25 : 3,
        width: 24, height: 24, borderRadius: '50%',
        background: active ? '#1A0E03' : MR_PALETTE.muted,
        transition: 'left .2s cubic-bezier(.16,1,.3,1)',
        boxShadow: '0 2px 6px rgba(0,0,0,.4)',
      }} />
    </button>
  );
}

function IncognitoGlyph({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8" opacity="0.5"/>
      <circle cx="12" cy="12" r="3"/>
      <line x1="3" y1="3" x2="21" y2="21"/>
    </svg>
  );
}

// Local helper duplicated for self-containment (matches screens.jsx)
const iconBtn = (highlight) => ({
  width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer',
  background: highlight ? `${MR_PALETTE.copper}22` : 'transparent',
  color: highlight ? MR_PALETTE.copper : MR_PALETTE.text,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

Object.assign(window, {
  PremiumGate, PREMIUM_VARIANTS,
  BoostConfirmModal, VideoCallModal, MoodTribeSheet, MoodRadio, TribeChip, IncognitoScreen,
  Toggle, IncognitoGlyph, TRIBES, MOODS,
});
