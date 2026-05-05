import { useState, useEffect, useCallback } from 'react';
import { useForm } from '@formspree/react';

const LAUNCH_DATE = new Date('2026-06-01T00:00:00Z');

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
    title: 'He\'s Right There',
    desc: 'See who\'s nearby right now. Not miles away. Not "active 3 days ago." Actually near you.',
  },
  {
    emoji: '🔥',
    title: 'Likes & Matches',
    desc: 'You both liked each other. The chat\'s open. Now stop overthinking it.',
  },
  {
    emoji: '💬',
    title: 'Real-Time Chat',
    desc: 'Talk dirty. Talk sweet. Talk now. No delays, no read receipts left on read.',
  },
  {
    emoji: '📹',
    title: 'Video Calls',
    desc: 'Face to face before face to... well. You know where this is going.',
  },
  {
    emoji: '🎯',
    title: 'Kink Filters',
    desc: 'Finally filter by what you actually want. We don\'t judge. We just deliver.',
  },
  {
    emoji: '👥',
    title: 'Group Rooms',
    desc: 'Find your tribe. Plan your Saturday night. Or just see who else is out.',
  },
  {
    emoji: '🔒',
    title: 'Your Terms',
    desc: 'Be seen by who you want. Ghost the rest. Zero drama, full control.',
  },
  {
    emoji: '✅',
    title: 'ID Verified',
    desc: 'Real men. Real faces. Free for everyone because trust shouldn\'t cost extra.',
  },
];

const premiumFeatures = [
  'See who already liked you',
  'Boost yourself to the top',
  'Like as many men as you want',
  'Browse invisibly like a ghost with good taste',
  'Filter by body type, kinks and more',
  'Send voice notes and spicy media',
  'Full photo gallery and video intro',
  'Access rooms others can\'t get into',
  'Find men way beyond 5km',
  'Know exactly when he\'s read your message',
];

export const ComingSoon = () => {
  const [state, handleSubmit] = useForm('maqaerkd');
  const [timeLeft, setTimeLeft] = useState(getTimeLeft);
  const [copied, setCopied] = useState(false);

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
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      {/* Background radial glow (brand-only, no photographic imagery) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_20%,rgba(196,131,42,0.12),transparent)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-12 sm:py-20">

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <img
            src="https://menrush.com/menrush-logo.png"
            alt="MenRush"
            className="h-36 w-36 rounded-full object-cover sm:h-44 sm:w-44"
            style={{ boxShadow: '0 4px 32px rgba(196,131,42,0.4)' }}
          />
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-[#A89070]">
            Coming Soon
          </span>
        </div>

        {/* Tagline */}
        <h1 className="mb-3 text-center text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">
          See who's near you{' '}
          <span className="bg-gradient-to-r from-[#C4832A] to-[#E8A04A] bg-clip-text text-transparent">
            right now.
          </span>
        </h1>
        <p className="mb-10 text-center text-sm font-medium text-[#A89070]">
          No waiting. No swiping. Just men nearby.
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
              className="flex flex-col items-center rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/60 py-4 backdrop-blur-md"
            >
              <span className="text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">
                {pad(value)}
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#A89070]">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Waitlist form */}
        <div className="mb-10 w-full rounded-3xl border border-[#3D2B0E] bg-[#1E1508]/60 p-6 backdrop-blur-md sm:p-8">
          <p className="mb-4 text-center text-sm font-medium text-[#A89070]">
            Join the waitlist. Get 30 days of Premium free when we launch.
          </p>
          {state.succeeded ? (
            <p className="text-center text-sm font-medium text-[#C4832A]">
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
                className="flex-1 rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/40 px-4 py-3.5 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/50 focus:border-[#C4832A]/60 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={state.submitting}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#D4943B] hover:to-[#9B5523] active:scale-[0.98] disabled:opacity-50 sm:whitespace-nowrap"
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
          <p className="mt-3 text-center text-xs text-[#A89070]">
            Early members get <span className="text-[#C4832A] font-semibold">30 days Premium free</span> at launch. No card needed.
          </p>
        </div>

        {/* Feature cards */}
        <div className="mb-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {features.map(({ emoji, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/60 p-4 backdrop-blur-md"
            >
              <span className="mb-2 block text-2xl">{emoji}</span>
              <p className="text-sm font-semibold text-[#F0E0C0]">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A89070]">{desc}</p>
            </div>
          ))}
        </div>

        {/* Premium section */}
        <div className="mb-10 w-full rounded-3xl border border-[#C4832A]/30 bg-[#1E1508]/60 p-6 backdrop-blur-md sm:p-8">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="text-lg">👑</span>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C4832A]">
              Premium — Coming with Launch
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {premiumFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="text-[#C4832A]">✦</span>
                <span className="text-xs text-[#F0E0C0]/80">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="relative flex items-center gap-2 rounded-full border border-[#3D2B0E] bg-[#1E1508]/60 px-5 py-2.5 text-sm font-medium text-[#A89070] backdrop-blur-md transition-all duration-200 hover:border-[#C4832A]/40 hover:text-[#F0E0C0] active:scale-[0.97]"
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
