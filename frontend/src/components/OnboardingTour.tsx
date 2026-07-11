import { useState } from 'react';

const steps = [
  {
    title: 'Pulse Mode',
    desc: "See who's nearby right now – no endless swiping",
    icon: '📍',
  },
  {
    title: 'Match Later',
    desc: "Chat and connect when you're both ready",
    icon: '💬',
  },
  {
    title: 'Safe & Verified',
    desc: 'ID badge free for everyone – trust built in',
    icon: '✅',
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingTour({ onDone }: Props) {
  const [current, setCurrent] = useState(0);

  const next = () => {
    if (current < steps.length - 1) setCurrent(current + 1);
    else onDone();
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(13,10,6,.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 400,
          background: 'rgba(30,21,8,.95)',
          border: '1px solid rgba(196,131,42,.35)',
          borderRadius: 28,
          padding: '40px 32px 32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,.6)',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 20 }}>{step.icon}</div>

        {/* Title */}
        <h2
          style={{
            margin: 0, color: '#F0E0C0',
            fontSize: 26, fontWeight: 900,
            letterSpacing: '-0.01em',
          }}
        >
          {step.title}
        </h2>

        {/* Description */}
        <p
          style={{
            margin: '14px 0 0',
            color: '#A89070', fontSize: 16, lineHeight: 1.6,
            minHeight: 52,
          }}
        >
          {step.desc}
        </p>

        {/* Dot indicators */}
        <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 22 : 8,
                height: 8,
                borderRadius: 999,
                border: 0,
                cursor: 'pointer',
                background: i === current ? '#C4832A' : 'rgba(196,131,42,.3)',
                transition: 'width 240ms cubic-bezier(.16,1,.3,1), background 240ms',
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28, width: '100%' }}>
          {current > 0 && (
            <button
              onClick={prev}
              style={{
                flex: 1, border: '1px solid rgba(196,131,42,.4)',
                borderRadius: 999, padding: '15px 0',
                background: 'transparent', color: '#C4832A',
                fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
                cursor: 'pointer',
                transition: 'border-color 200ms, color 200ms',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#C4832A';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(196,131,42,.4)';
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: 2, border: 0, borderRadius: 999, padding: '15px 0',
              background: 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)',
              color: '#FFF6E6',
              fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(196,131,42,.3)',
              transition: 'background 240ms cubic-bezier(.16,1,.3,1), transform 100ms',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(90deg, #E0A14A 0%, #C4832A 100%)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)';
            }}
            onMouseDown={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            {isLast ? "Let's go" : 'Next'}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={onDone}
            style={{
              marginTop: 16, background: 'none', border: 0,
              color: '#6B5840', fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
