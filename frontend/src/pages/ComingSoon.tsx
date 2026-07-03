import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { waitlistAPI } from '../api/client';

export const ComingSoon = () => {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const join = async () => {
    if (!email.trim() || !email.includes('@')) return;
    setSubmitting(true);
    try {
      await waitlistAPI.signup(email.trim());
      setJoined(true);
    } catch {
      setJoined(true); // still show success even if backend is down
    } finally {
      setSubmitting(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') join();
  };

  return (
    <div
      className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#0D0A06', color: '#F0E0C0', fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'center', padding: '64px 24px', boxSizing: 'border-box' }}
    >
      {/* Background photo */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: "url('/images/31-london-rooftop-dusk.jpeg')",
          backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.35,
        }}
      />
      {/* Gradient scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,10,6,.55) 0%, rgba(13,10,6,.8) 55%, rgba(13,10,6,.97) 100%)' }} />

      {/* Sign-in pill */}
      <Link
        to="/signin"
        style={{
          position: 'absolute', top: 24, right: 24, zIndex: 3,
          textDecoration: 'none', color: '#F0E0C0', fontSize: 15, fontWeight: 700,
          padding: '14px 22px', borderRadius: 14,
          border: '1px solid rgba(240,224,192,.4)', background: 'rgba(13,10,6,.45)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,131,42,.6)';
          (e.currentTarget as HTMLElement).style.color = '#E0A14A';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,224,192,.4)';
          (e.currentTarget as HTMLElement).style.color = '#F0E0C0';
        }}
      >
        Already have an invite? Sign in
      </Link>

      {/* Logo + radar rings */}
      <style>{`
        @keyframes mr-radar {
          0%   { transform: scale(1); opacity: .5; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mr-radar-ring { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
      <div style={{ position: 'relative', width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 34 }}>
        <span className="mr-radar-ring" style={{ position: 'absolute', width: 96, height: 96, borderRadius: '50%', background: '#C4832A', animation: 'mr-radar 2.4s cubic-bezier(.16,1,.3,1) infinite' }} />
        <span className="mr-radar-ring" style={{ position: 'absolute', width: 96, height: 96, borderRadius: '50%', background: '#C4832A', opacity: 0.3, animation: 'mr-radar 2.4s cubic-bezier(.16,1,.3,1) 1.2s infinite' }} />
        <img
          src="/menrush-logo.png"
          alt="MenRush"
          style={{ position: 'relative', zIndex: 2, width: 110, height: 110, borderRadius: '50%', boxShadow: '0 0 0 2px rgba(196,131,42,.4), 0 12px 44px rgba(0,0,0,.7)' }}
        />
      </div>

      {/* Overline */}
      <div style={{ position: 'relative', fontSize: 12, fontWeight: 700, letterSpacing: '0.32em', color: '#C4832A', marginBottom: 22 }}>
        MENRUSH · COMING SOON
      </div>

      {/* H1 */}
      <h1 style={{ position: 'relative', margin: 0, fontWeight: 900, fontSize: 'clamp(34px, 6vw, 64px)', lineHeight: 1.05, letterSpacing: '0.04em', textTransform: 'uppercase', maxWidth: 900, textWrap: 'balance' as any }}>
        Real men.<br />
        <span style={{ color: '#C4832A' }}>Verified bodies.</span><br />
        Total discretion.
      </h1>

      {/* Body copy */}
      <p style={{ position: 'relative', margin: '26px 0 0', fontSize: 'clamp(15px, 2vw, 19px)', lineHeight: 1.6, color: '#F0E0C0', maxWidth: 620 }}>
        MenRush checks every member with ID and selfie matching, so you know exactly who you're meeting.{' '}
        <strong style={{ color: '#E0A14A', fontWeight: 700 }}>No bots. No catfish. No scam profiles.</strong>
      </p>
      <p style={{ position: 'relative', margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: '#A89070', maxWidth: 560 }}>
        Your identity stays private. Your profile stays discreet. No time wasters.
      </p>

      {/* Waitlist */}
      <div style={{ position: 'relative', marginTop: 38, width: '100%', maxWidth: 460 }}>
        {joined ? (
          <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(196,131,42,.12)', border: '1px solid rgba(196,131,42,.45)', fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: '#E0A14A' }}>
            You're on the list. We'll be in touch — discreetly.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, background: '#1E1508', border: '1px solid #3D2B0E', borderRadius: 999, padding: '6px 6px 6px 22px', boxShadow: '0 10px 36px rgba(0,0,0,.5)' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={onKey}
              placeholder="Your email — never shown, never shared"
              disabled={submitting}
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: '#F0E0C0', fontSize: 14, fontFamily: 'inherit', padding: '10px 0' }}
            />
            <button
              onClick={join}
              disabled={submitting}
              style={{ flexShrink: 0, padding: '12px 22px', borderRadius: 999, border: 0, cursor: 'pointer', background: submitting ? '#8B5A1E' : '#C4832A', color: '#1A0E03', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', boxShadow: '0 0 24px rgba(196,131,42,.4)', transition: 'background 240ms cubic-bezier(.16,1,.3,1)' }}
              onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#E0A14A'; }}
              onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#C4832A'; }}
            >
              {submitting ? 'JOINING…' : 'JOIN THE VERIFIED WAITLIST'}
            </button>
          </div>
        )}
      </div>

      {/* Quote */}
      <p style={{ position: 'relative', margin: '44px 0 0', fontSize: 17, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F0E0C0' }}>
        "Your next nearby meet is real."
      </p>

      {/* Footer lines */}
      <div style={{ position: 'relative', marginTop: 26, fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: '#6B5840' }}>
        LONDON · MANCHESTER · BIRMINGHAM · BRIGHTON
      </div>
      <div style={{ position: 'relative', marginTop: 12, fontSize: 11, color: '#6B5840' }}>
        18+ only. Every member ID verified and selfie matched.
      </div>
    </div>
  );
};
