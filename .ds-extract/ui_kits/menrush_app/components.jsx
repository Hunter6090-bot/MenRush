// MenRush — small UI components.
// All export to window so screens.jsx can use them.
// Stick to inline styles + token references; never hardcode hex outside this file's "PALETTE" object.

const MR_PALETTE = {
  bg: '#0D0A06',
  card: '#1E1508',
  elevated: '#2A1C0A',
  border: '#3D2B0E',
  copper: '#C4832A',
  copperBright: '#E0A14A',
  rust: '#8B4513',
  text: '#F0E0C0',
  muted: '#A89070',
  faint: '#6B5840',
  online: '#6FA85A',
  danger: '#B0432E',
  warning: '#D4A24C',
};

// ── Icons ────────────────────────────────────────────────────
// Inline SVG, 2px stroke, currentColor, rounded — matches in-house style.
const Icon = ({ name, size = 20, strokeWidth = 2, style }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style,
  };
  switch (name) {
    case 'pulse':
      return <svg {...props}><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/></svg>;
    case 'compass':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" stroke="none"/></svg>;
    case 'flame':
      return <svg {...props}><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-5 2 1 3 0 3-4z"/></svg>;
    case 'chat':
      return <svg {...props}><path d="M21 12c0 4.4-4 8-9 8a9.9 9.9 0 0 1-4.3-1L3 20l1.4-3.7C3.5 15 3 13.6 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"/></svg>;
    case 'user':
      return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>;
    case 'filter':
      return <svg {...props}><path d="M3 4h18l-7 9v7l-4-2v-5z"/></svg>;
    case 'send':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2.5-7.5z"/></svg>;
    case 'pin':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"/></svg>;
    case 'check':
      return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'x':
      return <svg {...props}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>;
    case 'chevron-left':
      return <svg {...props}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'chevron-down':
      return <svg {...props}><polyline points="6 9 12 15 18 9"/></svg>;
    case 'more':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>;
    case 'video':
      return <svg {...props}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-3v10l-4-3z" fill="currentColor"/></svg>;
    case 'shield-check':
      return <svg {...props}><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><polyline points="9 12 11 14 15 10"/></svg>;
    case 'sparkle':
      return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>;
    case 'globe':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 4 3 16 0 20M12 2c-3 4-3 16 0 20"/></svg>;
    case 'camera':
      return <svg {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
    case 'image':
      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
    case 'mic':
      return <svg {...props}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></svg>;
    case 'play':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>;
    case 'pause':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
    case 'lock':
      return <svg {...props}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    default:
      return null;
  }
};

// ── Avatar with optional radar pulse ─────────────────────────
function PulsingAvatar({ name, photoUrl, pulsing = false, online = false, verified = false, size = 56, ringColor = MR_PALETTE.copper }) {
  const initial = (name || '?')[0].toUpperCase();
  const wrapSize = pulsing ? size * 1.5 : size;
  return (
    <div style={{ position: 'relative', width: wrapSize, height: wrapSize, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {pulsing && (
        <React.Fragment>
          <span className="radar-mini r1" style={{ inset: (wrapSize - size) / 2 }} />
          <span className="radar-mini r2" style={{ inset: (wrapSize - size) / 2 }} />
          <span className="radar-mini r3" style={{ inset: (wrapSize - size) / 2 }} />
        </React.Fragment>
      )}
      <div style={{
        position: 'relative', zIndex: 2,
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        background: `linear-gradient(160deg, ${MR_PALETTE.elevated}, ${MR_PALETTE.card})`,
        border: `2px solid ${ringColor}`,
        boxShadow: `0 0 0 3px ${ringColor}22, 0 4px 16px rgba(0,0,0,.5)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: MR_PALETTE.text, fontWeight: 700, fontSize: size * 0.35,
      }}>
        {photoUrl
          ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initial}
      </div>
      {verified && (
        <div style={{
          position: 'absolute', bottom: pulsing ? '20%' : -2, right: pulsing ? '20%' : -2,
          width: size * 0.32, height: size * 0.32, borderRadius: '50%',
          background: MR_PALETTE.copper, border: `2px solid ${MR_PALETTE.bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3,
          boxShadow: `0 0 12px ${MR_PALETTE.copper}88`,
        }}>
          <Icon name="check" size={size * 0.18} strokeWidth={3} style={{ color: '#1A0E03' }} />
        </div>
      )}
      {online && !verified && (
        <span style={{
          position: 'absolute', bottom: pulsing ? '22%' : 0, right: pulsing ? '22%' : 0,
          width: size * 0.26, height: size * 0.26, borderRadius: '50%',
          background: MR_PALETTE.online, boxShadow: `0 0 10px ${MR_PALETTE.online}`,
          border: `2.5px solid ${MR_PALETTE.bg}`, zIndex: 3,
        }} />
      )}
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────
function StatusBadge({ online, lastSeen, pulsing, size = 'sm', dotOnly = false }) {
  if (dotOnly) {
    const c = pulsing ? MR_PALETTE.copper : online ? MR_PALETTE.online : MR_PALETTE.muted;
    return (
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(13,10,6,.6)', backdropFilter: 'blur(10px)',
        border: `1px solid ${MR_PALETTE.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: c,
          opacity: pulsing || online ? 1 : .5,
          boxShadow: pulsing || online ? `0 0 8px ${c}` : 'none',
        }} />
      </span>
    );
  }
  if (pulsing) {
    return (
      <span style={badgeStyle({ bg: MR_PALETTE.copper, fg: '#1A0E03', glow: true, bold: true, size })}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A0E03' }} />
        PULSING
      </span>
    );
  }
  if (online) {
    return (
      <span style={badgeStyle({ bg: 'rgba(111,168,90,.13)', fg: '#8FC773', border: 'rgba(111,168,90,.35)', size })}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: MR_PALETTE.online, boxShadow: `0 0 8px ${MR_PALETTE.online}` }} />
        Active now
      </span>
    );
  }
  return (
    <span style={badgeStyle({ bg: 'rgba(168,144,112,.08)', fg: MR_PALETTE.muted, border: MR_PALETTE.border, size })}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: MR_PALETTE.muted, opacity: .5 }} />
      {lastSeen || 'Offline'}
    </span>
  );
}
const badgeStyle = ({ bg, fg, border, glow, bold, size }) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: size === 'xs' ? '3px 8px' : '4px 10px',
  borderRadius: 999, fontSize: size === 'xs' ? 10 : 11.5, fontWeight: bold ? 700 : 500,
  letterSpacing: bold ? '0.1em' : 0, textTransform: bold ? 'uppercase' : 'none',
  background: bg, color: fg,
  border: border ? `1px solid ${border}` : 'none',
  boxShadow: glow ? `0 0 16px ${MR_PALETTE.copper}55` : 'none',
  whiteSpace: 'nowrap',
});

// ── Verified badge (standalone) ──────────────────────────────
function VerifiedBadge({ size = 'sm' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'lg' ? '6px 12px' : '3px 9px',
      borderRadius: 999, background: 'rgba(196,131,42,.13)', color: MR_PALETTE.copper,
      border: `1px solid ${MR_PALETTE.copper}50`,
      fontSize: size === 'lg' ? 12 : 10.5, fontWeight: 600, letterSpacing: '0.04em',
    }}>
      <Icon name="check" size={size === 'lg' ? 13 : 11} strokeWidth={3} />
      ID verified
    </span>
  );
}

// ── "More" dropdown menu (three-dots) ────────────────────────
function MoreMenu({ items, style: btnStyle }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={btnStyle} title="More">
        <Icon name="more" size={20} />
      </button>
      {open && (
        <React.Fragment>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }}></div>
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 61,
            minWidth: 178, padding: 6, borderRadius: 12,
            background: MR_PALETTE.elevated, border: `1px solid ${MR_PALETTE.border}`,
            boxShadow: '0 12px 32px rgba(0,0,0,.6)',
          }}>
            {items.map(it => (
              <button key={it.label} onClick={() => { setOpen(false); it.onClick && it.onClick(); }} style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                padding: '9px 10px', borderRadius: 8, border: 0, cursor: 'pointer',
                background: 'transparent', textAlign: 'left', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600,
                color: it.danger ? MR_PALETTE.danger : MR_PALETTE.text,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,131,42,.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{it.label}</button>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ── Distance pill ────────────────────────────────────────────
function DistancePill({ mi, dark = true, size = 'md' }) {
  const display = mi < 1 ? `${Math.round(mi * 1760)} yd` : `${mi.toFixed(1)} mi`;
  const xs = size === 'xs';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: xs ? 3 : 4,
      padding: xs ? '2px 6px' : '4px 10px', borderRadius: 999,
      background: dark ? 'rgba(13,10,6,.6)' : MR_PALETTE.elevated,
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      border: `1px solid ${dark ? MR_PALETTE.border : 'transparent'}`,
      color: MR_PALETTE.text, fontSize: xs ? 9 : 11, fontWeight: 500,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <Icon name="pin" size={xs ? 8 : 10} style={{ color: MR_PALETTE.copper }} />
      {display}
    </span>
  );
}

// ── Tribe / mood pill ────────────────────────────────────────
function TribePill({ children, active = false, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px', borderRadius: 999,
      background: active ? MR_PALETTE.copper : 'rgba(196,131,42,.07)',
      color: active ? '#1A0E03' : MR_PALETTE.text,
      border: `1px solid ${active ? 'transparent' : MR_PALETTE.border}`,
      fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
      boxShadow: active ? `0 0 14px ${MR_PALETTE.copper}44` : 'none',
      whiteSpace: 'nowrap', fontFamily: 'inherit',
    }}>{children}</button>
  );
}

// ── Pulse FAB ────────────────────────────────────────────────
function PulseFab({ active = true, onClick, size = 64 }) {
  return (
    <button onClick={onClick} aria-label="Pulse" style={{
      position: 'relative', width: size * 1.6, height: size * 1.6,
      border: 0, background: 'transparent', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 0,
    }}>
      {active && (
        <React.Fragment>
          <span style={{ ...pulseRing(size), opacity: .55, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite' }} />
          <span style={{ ...pulseRing(size), opacity: .38, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) .8s infinite' }} />
          <span style={{ ...pulseRing(size), opacity: .22, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) 1.6s infinite' }} />
        </React.Fragment>
      )}
      <span style={{
        position: 'relative', zIndex: 2, width: size, height: size, borderRadius: '50%',
        overflow: 'hidden',
        background: active
          ? `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper} 55%, ${MR_PALETTE.rust})`
          : MR_PALETTE.elevated,
        boxShadow: active
          ? `0 8px 28px rgba(0,0,0,.55), 0 0 32px ${MR_PALETTE.copper}99, inset 0 1px 0 rgba(255,220,170,.4)`
          : '0 6px 18px rgba(0,0,0,.4)',
        border: active ? `1px solid rgba(255,200,130,.25)` : `1px solid ${MR_PALETTE.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src="../../assets/menrush-logo.png" alt="" draggable="false" style={{
          width: '100%', height: '100%', objectFit: 'cover',
          filter: active ? 'none' : 'grayscale(.7) brightness(.6)',
        }} />
      </span>
    </button>
  );
}
const pulseRing = (size) => ({
  position: 'absolute', width: size, height: size, borderRadius: '50%',
  background: MR_PALETTE.copper, top: '50%', left: '50%', marginTop: -size/2, marginLeft: -size/2,
});

// ── Buttons ──────────────────────────────────────────────────
function Button({ children, variant = 'primary', onClick, full = false, size = 'md', disabled, style }) {
  const sizes = {
    sm: { padding: '8px 16px', fontSize: 12 },
    md: { padding: '12px 22px', fontSize: 14 },
    lg: { padding: '14px 24px', fontSize: 14 },
  };
  const variants = {
    primary: { background: MR_PALETTE.copper, color: '#1A0E03', boxShadow: `0 0 24px ${MR_PALETTE.copper}55`, border: 0 },
    secondary: { background: 'transparent', color: MR_PALETTE.copper, border: `1px solid ${MR_PALETTE.copper}` },
    ghost: { background: 'rgba(196,131,42,.07)', color: MR_PALETTE.text, border: `1px solid ${MR_PALETTE.border}` },
    danger: { background: 'transparent', color: MR_PALETTE.danger, border: `1px solid ${MR_PALETTE.danger}80` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...sizes[size], ...variants[variant],
      width: full ? '100%' : 'auto',
      borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 600, fontFamily: 'inherit', letterSpacing: '0.04em', textTransform: 'uppercase',
      opacity: disabled ? .5 : 1, transition: 'transform .15s ease',
      ...style,
    }}>{children}</button>
  );
}

// ── Message bubble ───────────────────────────────────────────
function MessageBubble({ children, mine = false, time, seen }) {
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '76%', padding: '10px 14px',
        background: mine ? `linear-gradient(135deg, ${MR_PALETTE.copper}, ${MR_PALETTE.rust})` : MR_PALETTE.elevated,
        color: mine ? '#1A0E03' : MR_PALETTE.text,
        border: mine ? 0 : `1px solid ${MR_PALETTE.border}`,
        borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        fontSize: 14.5, lineHeight: 1.45, fontWeight: mine ? 500 : 400,
        boxShadow: '0 4px 16px rgba(0,0,0,.45)',
      }}>
        {children}
        {time && (
          <div style={{
            fontSize: 10, marginTop: 4,
            opacity: mine ? .55 : .5,
            color: mine ? '#1A0E03' : MR_PALETTE.muted,
            fontFamily: 'ui-monospace, monospace',
          }}>{time}{seen ? ' · seen' : ''}</div>
        )}
      </div>
    </div>
  );
}

// ── Bottom nav (4 tabs) ──────────────────────────────────────
function BottomNav({ active, onSelect, unread = 0, pulsing = false, onPulse }) {
  const tabs = [
    { id: 'discover', label: 'Nearby', icon: 'compass' },
    { id: 'matches', label: 'Matches', icon: 'flame' },
    { id: 'pulse',   label: 'Pulse',   center: true },
    { id: 'chat',    label: 'Chat',    icon: 'chat', badge: unread },
    { id: 'profile', label: 'You',     icon: 'user' },
  ];
  return (
    <nav style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 96,
      background: 'rgba(13,10,6,.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${MR_PALETTE.border}`,
      display: 'flex', alignItems: 'flex-start', paddingTop: 10, paddingBottom: 26, zIndex: 30,
    }}>
      {tabs.map(t => {
        if (t.center) {
          return (
            <button key={t.id} onClick={onPulse} aria-label="Pulse" style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
              color: pulsing ? MR_PALETTE.copper : MR_PALETTE.faint,
              fontFamily: 'inherit', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
            }}>
              <span style={{ position: 'relative', width: 46, height: 46, marginTop: -18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pulsing && (
                  <React.Fragment>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: MR_PALETTE.copper, opacity: .45, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite' }} />
                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: MR_PALETTE.copper, opacity: .25, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) 1.2s infinite' }} />
                  </React.Fragment>
                )}
                <span style={{
                  position: 'relative', zIndex: 2, width: 46, height: 46, borderRadius: '50%', overflow: 'hidden',
                  border: pulsing ? '1.5px solid rgba(255,200,130,.5)' : `1.5px solid ${MR_PALETTE.border}`,
                  boxShadow: pulsing ? `0 4px 18px rgba(0,0,0,.5), 0 0 24px ${MR_PALETTE.copper}88` : '0 4px 14px rgba(0,0,0,.45)',
                }}>
                  <img src="../../assets/menrush-logo.png" alt="" draggable="false" style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: pulsing ? 'none' : 'grayscale(.7) brightness(.6)',
                  }} />
                </span>
              </span>
              {t.label}
            </button>
          );
        }
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onSelect(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: 'transparent', border: 0, cursor: 'pointer', padding: '4px 0',
            color: on ? MR_PALETTE.copper : MR_PALETTE.faint,
            fontFamily: 'inherit', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
          }}>
            <span style={{ position: 'relative', transform: on ? 'scale(1.1)' : 'scale(1)', transition: 'transform .2s' }}>
              <Icon name={t.icon} size={22} strokeWidth={on ? 2.4 : 2} />
              {t.badge > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -5, minWidth: 14, height: 14, borderRadius: 7,
                  background: MR_PALETTE.copper, color: '#1A0E03', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  border: `1.5px solid ${MR_PALETTE.bg}`,
                }}>{t.badge > 9 ? '9+' : t.badge}</span>
              )}
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

// ── Top header ───────────────────────────────────────────────
function TopBar({ title, subtitle, left, right }) {
  return (
    <header style={{
      height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(13,10,6,.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${MR_PALETTE.border}`, position: 'relative', zIndex: 20,
      flexShrink: 0,
    }}>
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: MR_PALETTE.text,
        }}>{title}</div>}
        {subtitle && <div style={{ fontSize: 11, color: MR_PALETTE.muted, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

// ── Modal scrim ──────────────────────────────────────────────
function Scrim({ onClose, children, style }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, animation: 'nn-fade-in .25s cubic-bezier(.16,1,.3,1)',
      ...style,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  MR_PALETTE, Icon,
  PulsingAvatar, StatusBadge, VerifiedBadge, DistancePill, TribePill,
  PulseFab, Button, MessageBubble, BottomNav, TopBar, Scrim, MoreMenu,
});
