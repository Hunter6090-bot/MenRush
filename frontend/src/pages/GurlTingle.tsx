import { useState, useEffect, useCallback } from 'react';
import { useForm } from '@formspree/react';

const LAUNCH_DATE = new Date('2026-06-01T00:00:00Z');

const IMAGES = [
  'https://upload.wikimedia.org/wikipedia/commons/4/45/1991SFPrideKodak5095Gold100-2Film_0017_-_Queer_Youth_%289852371234%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/a/ae/Los_Angeles_Pride_1995_003.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/5/50/Dallas_Pride_Parade.JPG',
  'https://upload.wikimedia.org/wikipedia/commons/3/38/DC_Gay_Pride_-_Parade_-_2010-06-12_-_060_%286250148131%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/2/2d/Capital_Pride_Festival_DC_2014_%2814372375396%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/b/be/Amsterdam_Gay_Pride_2004%2C_Canal_parade_-016.JPG',
  'https://upload.wikimedia.org/wikipedia/commons/e/eb/Christopher_Street_Day_Karlsruhe_03_June_2023_-_036.jpg',
];

function getTimeLeft() {
  const diff = LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const features = [
  {
    emoji: '📍',
    title: 'She\'s Right There',
    desc: 'See who\'s nearby right now. Not "active 3 days ago." Actually near you.',
  },
  {
    emoji: '💖',
    title: 'Likes & Matches',
    desc: 'You both liked each other. The chat\'s open. Slide in like you mean it.',
  },
  {
    emoji: '💬',
    title: 'Real-Time Chat',
    desc: 'Talk soft. Talk bold. Talk now. No delays, no left-on-read drama.',
  },
  {
    emoji: '📹',
    title: 'Video Calls',
    desc: 'See her smile before the first date. Vibes check, in real time.',
  },
  {
    emoji: '🎯',
    title: 'Your Type',
    desc: 'Filter by what you actually want. Femme, masc, soft, sharp — your call.',
  },
  {
    emoji: '👥',
    title: 'Group Rooms',
    desc: 'Find your circle. Plan the night out. Or just see who else is around.',
  },
  {
    emoji: '🔒',
    title: 'Your Terms',
    desc: 'Be seen by who you want. Block the rest. Zero drama, full control.',
  },
  {
    emoji: '✅',
    title: 'ID Verified',
    desc: 'Real women. Real faces. Free for everyone because safety isn\'t a perk.',
  },
];

const premiumFeatures = [
  'See who already liked you',
  'Boost yourself to the top',
  'Like as many women as you want',
  'Browse invisibly when you\'re just curious',
  'Filter by style, vibe, intentions and more',
  'Send voice notes and private media',
  'Full photo gallery and video intro',
  'Access rooms others can\'t get into',
  'Find women way beyond 5km',
  'Know exactly when she\'s read your message',
];

export const GurlTingle = () => {
  const [state, handleSubmit] = useForm('maqaerkd');
  const [timeLeft, setTimeLeft] = useState(getTimeLeft);
  const [copied, setCopied] = useState(false);
  const [bgIndex] = useState(() => Math.floor(Math.random() * IMAGES.length));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-[#15060F] text-[#FFE4EC]">
      {/* Background image slideshow */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${IMAGES[bgIndex]}')`,
          opacity: 0.55,
        }}
      />

      {/* Dark overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[#15060F]/40" />

      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_20%,rgba(233,30,99,0.18),transparent)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-12 sm:py-20">

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6FA5] via-[#E91E63] to-[#9C1458] sm:h-44 sm:w-44"
            style={{ boxShadow: '0 4px 32px rgba(233,30,99,0.45)' }}
          >
            <span className="text-5xl font-black tracking-tight text-white sm:text-6xl">GT</span>
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-[#E0A8C0]">
            Coming Soon
          </span>
        </div>

        {/* Tagline */}
        <h1 className="mb-3 text-center text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">
          See who's near you{' '}
          <span className="bg-gradient-to-r from-[#FF6FA5] to-[#E91E63] bg-clip-text text-transparent">
            right now.
          </span>
        </h1>
        <p className="mb-10 text-center text-sm font-medium text-[#E0A8C0]">
          No waiting. No swiping. Just women nearby.
        </p>

        {/* Countdown */}
        <div className="mb-10 grid w-full grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Days', value: timeLeft.days },
            { label: 'Hours', value: timeLeft.hours },
            { label: 'Mins', value: timeLeft.minutes },
            { label: 'Secs', value: timeLeft.seconds },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-2xl border border-[#4A1B30] bg-[#2A0F1F]/60 py-4 backdrop-blur-md"
            >
              <span className="text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">
                {pad(value)}
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#E0A8C0]">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Waitlist form */}
        <div className="mb-10 w-full rounded-3xl border border-[#4A1B30] bg-[#2A0F1F]/60 p-6 backdrop-blur-md sm:p-8">
          <p className="mb-4 text-center text-sm font-medium text-[#E0A8C0]">
            Join the waitlist. Get 30 days of Premium free when we launch.
          </p>
          {state.succeeded ? (
            <p className="text-center text-sm font-medium text-[#FF6FA5]">
              You're on the list. 30 days of Premium are waiting for you at launch.
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={state.submitting}
                className="flex-1 rounded-2xl border border-[#4A1B30] bg-[#2A0F1F]/40 px-4 py-3.5 text-sm text-[#FFE4EC] placeholder:text-[#E0A8C0]/50 focus:border-[#E91E63]/60 focus:outline-none focus:ring-2 focus:ring-[#E91E63]/25 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={state.submitting}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E91E63] to-[#9C1458] px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#FF2F74] hover:to-[#AC1E68] active:scale-[0.98] disabled:opacity-50 sm:whitespace-nowrap"
              >
                {state.submitting ? (
                  <>
                    <Spinner />
                    Sending…
                  </>
                ) : (
                  'Get Early Access'
                )}
              </button>
            </form>
          )}
          <p className="mt-3 text-center text-xs text-[#E0A8C0]">
            Early members get <span className="text-[#FF6FA5] font-semibold">30 days Premium free</span> at launch. No card needed.
          </p>
        </div>

        {/* Feature cards */}
        <div className="mb-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {features.map(({ emoji, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[#4A1B30] bg-[#2A0F1F]/60 p-4 backdrop-blur-md"
            >
              <span className="mb-2 block text-2xl">{emoji}</span>
              <p className="text-sm font-semibold text-[#FFE4EC]">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#E0A8C0]">{desc}</p>
            </div>
          ))}
        </div>

        {/* Premium section */}
        <div className="mb-10 w-full rounded-3xl border border-[#E91E63]/30 bg-[#2A0F1F]/60 p-6 backdrop-blur-md sm:p-8">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="text-lg">👑</span>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#FF6FA5]">
              Premium — Coming with Launch
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {premiumFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="text-[#FF6FA5]">✦</span>
                <span className="text-xs text-[#FFE4EC]/80">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="relative flex items-center gap-2 rounded-full border border-[#4A1B30] bg-[#2A0F1F]/60 px-5 py-2.5 text-sm font-medium text-[#E0A8C0] backdrop-blur-md transition-all duration-200 hover:border-[#E91E63]/40 hover:text-[#FFE4EC] active:scale-[0.97]"
        >
          <ShareIcon className="h-4 w-4" />
          {copied ? 'Link copied!' : 'Share with a friend'}
        </button>
      </div>
    </div>
  );
};

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);
