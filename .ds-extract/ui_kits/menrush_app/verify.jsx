// MenRush — ID verification flow.
// Five stages: intro · capture · selfie · pending · verified.
// Verified badge is FREE FOR ALL — not a premium gate. Trust signal.
// Globals: MR_PALETTE, Icon, Button, TopBar, VerifiedBadge

function VerifyFlow({ stage: initial = 'intro', onBack, onAdvance }) {
  const [stage, setStage] = React.useState(initial);
  const next = (s) => setStage(s);
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      background: MR_PALETTE.bg, zIndex: 50,
    }}>
      <TopBar
        left={<button onClick={onBack} style={vIconBtn}><Icon name="chevron-left" size={22} strokeWidth={2.2} /></button>}
        title="VERIFY ID"
      />
      {stage === 'intro'   && <VerifyIntro   onCapture={() => next('capture')} />}
      {stage === 'capture' && <VerifyCapture onTakeSelfie={() => next('selfie')} onBack={() => next('intro')} />}
      {stage === 'selfie'  && <VerifySelfie  onSubmit={() => next('pending')} onBack={() => next('capture')} />}
      {stage === 'pending' && <VerifyPending onCheck={() => next('verified')} />}
      {stage === 'verified' && <VerifyDone   onAdvance={onAdvance} />}
    </div>
  );
}
const vIconBtn = { width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer', background: 'transparent', color: MR_PALETTE.text, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const verifyScroll = { flex: 1, padding: '24px 22px 30px', overflowY: 'auto', display: 'flex', flexDirection: 'column' };

// ── Intro / explainer ───────────────────────────────────────
function VerifyIntro({ onCapture }) {
  return (
    <div style={verifyScroll}>
      {/* hero */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, marginBottom: 18 }}>
        <div style={{
          width: 92, height: 92, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${MR_PALETTE.copper}66, inset 0 1px 0 rgba(255,220,170,.4)`,
          color: '#1A0E03',
        }}>
          <Icon name="shield-check" size={42} strokeWidth={2} />
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={vEyebrow}>VERIFIED IS FREE · ALWAYS</div>
        <h2 style={vH2}>Prove you're you.</h2>
        <p style={vSub}>
          Snap your ID, then a selfie. We compare them and delete the documents after review.
          You get a copper checkmark on your card. Verified men tend to get more replies.
        </p>
      </div>

      {/* what we do / don't do */}
      <div style={vRow}><Icon name="check" size={16} strokeWidth={2.4} style={{ color: MR_PALETTE.copper, marginTop: 2, flexShrink: 0 }} />
        <div><div style={vRowT}>Free, forever</div><div style={vRowD}>Verification is never behind a paywall.</div></div></div>
      <div style={vRow}><Icon name="check" size={16} strokeWidth={2.4} style={{ color: MR_PALETTE.copper, marginTop: 2, flexShrink: 0 }} />
        <div><div style={vRowT}>Documents auto-deleted</div><div style={vRowD}>ID photo + selfie are removed after the badge is issued.</div></div></div>
      <div style={vRow}><Icon name="check" size={16} strokeWidth={2.4} style={{ color: MR_PALETTE.copper, marginTop: 2, flexShrink: 0 }} />
        <div><div style={vRowT}>Your age is the only data kept</div><div style={vRowD}>Name + DOB confirm 18+. Nothing else.</div></div></div>
      <div style={vRow}><Icon name="x" size={16} strokeWidth={2.4} style={{ color: MR_PALETTE.faint, marginTop: 2, flexShrink: 0 }} />
        <div><div style={{ ...vRowT, color: MR_PALETTE.muted }}>Never shown to other users</div><div style={vRowD}>Profiles only ever see the copper checkmark, not your documents.</div></div></div>

      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        <Button variant="primary" full size="lg" onClick={onCapture}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="shield-check" size={16} strokeWidth={2.2} /> START VERIFICATION
          </span>
        </Button>
        <p style={{ textAlign: 'center', fontSize: 11, color: MR_PALETTE.faint, marginTop: 10 }}>Takes about 60 seconds.</p>
      </div>
    </div>
  );
}

// ── ID capture (camera viewfinder mock) ─────────────────────
function VerifyCapture({ onTakeSelfie, onBack }) {
  const [side, setSide] = React.useState('front');
  return (
    <div style={verifyScroll}>
      <div style={{ textAlign: 'left', marginBottom: 12 }}>
        <div style={vEyebrow}>STEP 1 OF 2</div>
        <h2 style={vH2}>Front of your ID.</h2>
        <p style={vSub}>Driver's license, passport, or national ID. Fill the frame.</p>
      </div>
      {/* viewfinder */}
      <div style={{
        position: 'relative', aspectRatio: '1.6/1', borderRadius: 16, overflow: 'hidden',
        background: 'linear-gradient(180deg, #1A1106 0%, #0D0A06 100%)',
        border: `1px solid ${MR_PALETTE.border}`, marginBottom: 18,
      }}>
        {/* corners */}
        {[[0,0,'tl'],[0,1,'tr'],[1,0,'bl'],[1,1,'br']].map(([y,x,k]) => (
          <div key={k} style={{
            position: 'absolute',
            [y ? 'bottom' : 'top']: 14, [x ? 'right' : 'left']: 14,
            width: 26, height: 26,
            borderTop: y ? 0 : `2px solid ${MR_PALETTE.copper}`,
            borderBottom: y ? `2px solid ${MR_PALETTE.copper}` : 0,
            borderLeft: x ? 0 : `2px solid ${MR_PALETTE.copper}`,
            borderRight: x ? `2px solid ${MR_PALETTE.copper}` : 0,
          }} />
        ))}
        {/* placeholder ID outline */}
        <div style={{
          position: 'absolute', left: 32, right: 32, top: 32, bottom: 32,
          border: `1px dashed ${MR_PALETTE.copper}55`, borderRadius: 8,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, color: MR_PALETTE.muted,
        }}>
          <Icon name="user" size={32} strokeWidth={1.4} style={{ opacity: .4 }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em' }}>POSITION ID INSIDE FRAME</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 18 }}>
        <button onClick={() => setSide('front')} style={side === 'front' ? vChip : vChipOff}>FRONT</button>
        <button onClick={() => setSide('back')} style={side === 'back' ? vChip : vChipOff}>BACK</button>
      </div>
      {/* shutter */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center', marginTop: 6 }}>
        <button onClick={onBack} style={vTextBtn}>Cancel</button>
        <button onClick={onTakeSelfie} aria-label="Capture" style={{
          width: 64, height: 64, borderRadius: '50%',
          background: MR_PALETTE.copper, border: `4px solid ${MR_PALETTE.bg}`,
          boxShadow: `0 0 0 2px ${MR_PALETTE.copper}, 0 0 32px ${MR_PALETTE.copper}88`,
          cursor: 'pointer',
        }} />
        <button onClick={onTakeSelfie} style={vTextBtn}>Use file</button>
      </div>
      <p style={{ textAlign: 'center', fontSize: 11, color: MR_PALETTE.faint, marginTop: 14 }}>
        Tip — flat surface, soft light, no glare.
      </p>
    </div>
  );
}

// ── Selfie capture ──────────────────────────────────────────
function VerifySelfie({ onSubmit, onBack }) {
  return (
    <div style={verifyScroll}>
      <div style={{ textAlign: 'left', marginBottom: 12 }}>
        <div style={vEyebrow}>STEP 2 OF 2</div>
        <h2 style={vH2}>Selfie.</h2>
        <p style={vSub}>Hold steady. Face the camera. No filters.</p>
      </div>
      {/* circular viewfinder */}
      <div style={{
        position: 'relative', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 40%, #2A1C0A 0%, #0D0A06 80%)',
        border: `2px dashed ${MR_PALETTE.copper}66`, marginBottom: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8,
        color: MR_PALETTE.muted, maxWidth: 260, alignSelf: 'center',
      }}>
        <Icon name="user" size={80} strokeWidth={1.2} style={{ opacity: .35 }} />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em' }}>CENTER YOUR FACE</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
        <button onClick={onBack} style={vTextBtn}>Retake ID</button>
        <button onClick={onSubmit} aria-label="Capture" style={{
          width: 64, height: 64, borderRadius: '50%',
          background: MR_PALETTE.copper, border: `4px solid ${MR_PALETTE.bg}`,
          boxShadow: `0 0 0 2px ${MR_PALETTE.copper}, 0 0 32px ${MR_PALETTE.copper}88`,
          cursor: 'pointer',
        }} />
        <button onClick={onSubmit} style={vTextBtn}>Skip</button>
      </div>
    </div>
  );
}

// ── Pending review ──────────────────────────────────────────
function VerifyPending({ onCheck }) {
  return (
    <div style={verifyScroll}>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 18 }}>
        <div style={{
          position: 'relative', width: 96, height: 96, borderRadius: '50%',
          background: MR_PALETTE.elevated, border: `1px solid ${MR_PALETTE.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Spinner size={42} />
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={vEyebrow}>UNDER REVIEW</div>
        <h2 style={vH2}>Hang tight.</h2>
        <p style={vSub}>
          We're checking your documents. Usually <b style={{ color: MR_PALETTE.text }}>under 2 minutes</b>,
          sometimes a few hours during off-peak.
        </p>
      </div>

      {/* progress steps */}
      <div style={{ background: MR_PALETTE.card, border: `1px solid ${MR_PALETTE.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
        <Step label="Capture ID" done />
        <Step label="Take selfie" done />
        <Step label="Review documents" pending />
        <Step label="Issue badge" />
      </div>

      <p style={{ fontSize: 12, color: MR_PALETTE.muted, lineHeight: 1.5, marginBottom: 18 }}>
        We'll send you a notification the moment it's done. You can keep using the app while you wait — your card just won't show the badge yet.
      </p>

      <div style={{ marginTop: 'auto' }}>
        <Button variant="secondary" full onClick={onCheck}>CHECK STATUS</Button>
      </div>
    </div>
  );
}

function Step({ label, done, pending }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        background: done ? MR_PALETTE.copper : pending ? 'transparent' : MR_PALETTE.elevated,
        border: pending ? `2px solid ${MR_PALETTE.copper}` : done ? 'none' : `1px solid ${MR_PALETTE.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: done ? `0 0 8px ${MR_PALETTE.copper}88` : 'none',
        animation: pending ? 'nn-pulse-soft 1.6s ease-in-out infinite' : 'none',
      }}>
        {done && <Icon name="check" size={11} strokeWidth={3.5} style={{ color: '#1A0E03' }} />}
      </div>
      <span style={{
        fontSize: 13.5, fontWeight: done || pending ? 600 : 400,
        color: done ? MR_PALETTE.text : pending ? MR_PALETTE.copper : MR_PALETTE.muted,
      }}>{label}</span>
    </div>
  );
}

function Spinner({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 1.2s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke={MR_PALETTE.border} strokeWidth="2.5" fill="none" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke={MR_PALETTE.copper} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Verified · success ──────────────────────────────────────
function VerifyDone({ onAdvance }) {
  return (
    <div style={verifyScroll}>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 18 }}>
        <div style={{
          position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ position: 'absolute', inset: 24, borderRadius: '50%', background: MR_PALETTE.copper, opacity: .5, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite' }} />
          <span style={{ position: 'absolute', inset: 24, borderRadius: '50%', background: MR_PALETTE.copper, opacity: .3, animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) .8s infinite' }} />
          <div style={{
            position: 'relative', zIndex: 2, width: 64, height: 64, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})`,
            border: `3px solid ${MR_PALETTE.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 30px ${MR_PALETTE.copper}aa, inset 0 1px 0 rgba(255,220,170,.4)`,
            color: '#1A0E03',
          }}>
            <Icon name="check" size={32} strokeWidth={3.2} />
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={vEyebrow}>VERIFIED</div>
        <h2 style={vH2}>You're verified.</h2>
        <p style={vSub}>
          Your card now shows the copper checkmark, and verified men tend to get more replies.
        </p>
      </div>

      {/* badge preview */}
      <div style={{
        background: MR_PALETTE.card, border: `1px solid ${MR_PALETTE.border}`, borderRadius: 14,
        padding: 18, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
      }}>
        <PulsingAvatar name="You" verified size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: MR_PALETTE.text, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Your card · now <VerifiedBadge />
          </div>
          <div style={{ fontSize: 12, color: MR_PALETTE.muted, marginTop: 3 }}>Documents removed after verification.</div>
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Button variant="primary" full size="lg" onClick={onAdvance}>BACK TO NEARBY</Button>
      </div>
    </div>
  );
}

const vEyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', color: MR_PALETTE.copper };
const vH2 = { margin: '10px 0 8px', fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: MR_PALETTE.text };
const vSub = { fontSize: 13.5, color: MR_PALETTE.muted, margin: 0, lineHeight: 1.5 };
const vRow = { display: 'flex', gap: 12, padding: '10px 0' };
const vRowT = { fontSize: 13.5, fontWeight: 600, color: MR_PALETTE.text };
const vRowD = { fontSize: 12, color: MR_PALETTE.muted, marginTop: 2, lineHeight: 1.4 };
const vChip = { padding: '6px 14px', borderRadius: 999, border: 0, background: MR_PALETTE.copper, color: '#1A0E03', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'inherit', cursor: 'pointer', textTransform: 'uppercase' };
const vChipOff = { ...vChip, background: 'transparent', color: MR_PALETTE.muted, border: `1px solid ${MR_PALETTE.border}` };
const vTextBtn = { background: 'transparent', border: 0, color: MR_PALETTE.muted, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 12px' };

Object.assign(window, { VerifyFlow, VerifyIntro, VerifyCapture, VerifySelfie, VerifyPending, VerifyDone });
