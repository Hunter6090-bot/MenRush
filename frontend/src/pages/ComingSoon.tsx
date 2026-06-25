import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { BRAND_MEDALLION } from '../lib/brand';
import {
  IconDiscover,
  IconMatches,
  IconChat,
  IconRooms,
  IconPulse,
} from '../components/icons';
import type { ComponentType, SVGProps } from 'react';
import { trackEvent, trackEventOnce } from '../observability/analytics';

const API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(API_BASE_URL);
const WAITLIST_API_URL = API_BASE_URL && (!IS_LOCAL_API || import.meta.env.DEV)
  ? `${API_BASE_URL}/waitlist`
  : null;
const ZOHO_SUBMIT_URL =
  'https://forms.zohopublic.com/hellomen1/form/MenRushcom/formperma/ridAzzP0GwTafugVKgaUQttHXDojK1z_jZpTDjtAor4/records';

const IMAGES = [
  '/images/menrush/01-rooftop-skyline-bears.jpeg',
  '/images/menrush/02-soho-night-crowd.jpeg',
  '/images/menrush/04-leather-harness-bears.jpeg',
  '/images/menrush/16-amsterdam-neon-night.jpeg',
  '/images/menrush/22-daddy-twink-bar.jpeg',
  '/images/menrush/31-london-rooftop-dusk.jpeg',
  '/images/menrush/36-wet-street-bar-line.jpeg',
  '/images/menrush/41-twink-jock-neon-street.jpeg',
];

function IconVideo({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconVerified({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" />
      <polyline points="8.8 12.2 11 14.4 15.6 9.8" />
    </svg>
  );
}

const features: { Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>; title: string; desc: string }[] = [
  {
    Icon: IconDiscover,
    title: "See who's near you",
    desc: 'Live proximity. Default 5 km. Who is active right now — not three days ago.',
  },
  {
    Icon: IconMatches,
    title: 'Matches',
    desc: 'Mutual like opens chat. No queue. No waiting period.',
  },
  {
    Icon: IconChat,
    title: 'Real-time chat',
    desc: 'Direct messages. One-to-one. Say something direct.',
  },
  {
    Icon: IconVideo,
    title: 'Video calls',
    desc: 'In-app video. Dark chrome. Copper accents.',
  },
  {
    Icon: IconPulse,
    title: 'Pulse',
    desc: 'Go visible. Top of nearby lists. The radar rings mean you are live.',
  },
  {
    Icon: IconRooms,
    title: 'Group rooms',
    desc: 'Location and tribe chat. Find your crowd nearby.',
  },
  {
    Icon: IconDiscover,
    title: 'Privacy controls',
    desc: 'Visible or invisible. You choose who sees you.',
  },
  {
    Icon: IconVerified,
    title: 'ID verified',
    desc: 'Trust badge for everyone. Free — not a premium perk.',
  },
];

const premiumFeatures = [
  'See who already signalled you',
  'Boost yourself to the top',
  'Signal as many men as you want',
  'Browse invisibly like a ghost with good taste',
  'Filter by body type, kinks and more',
  'Send voice notes and spicy media',
  'Full photo gallery and video intro',
  "Access rooms others can't get into",
  'Find men way beyond 5 km',
  "Know exactly when he's read your message",
];

export const ComingSoon = () => {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [bgIndex] = useState(() => Math.floor(Math.random() * IMAGES.length));

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'coming_soon' });
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

  const handleWaitlistSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting || submitted) return;

      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        trackEvent('waitlist_failed', { stage: 'validation', transport: 'none' });
        setErrorMsg('Please enter a valid email address.');
        return;
      }

      trackEvent('waitlist_attempted', {
        transport: WAITLIST_API_URL ? 'backend' : 'zoho_fallback',
      });
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
        let alreadySubscribed = false;
        if (WAITLIST_API_URL) {
          const response = await fetch(WAITLIST_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: trimmed, source: 'menrush.com' }),
          });

          const data = await response.json().catch(() => null);
          if (!response.ok) {
            const message = data?.error || 'Could not join the waitlist right now. Please try again.';
            throw new Error(message);
          }
          alreadySubscribed = Boolean(data?.already_subscribed);
        }

        setSubmitted(true);
        trackEvent('waitlist_succeeded', {
          transport: WAITLIST_API_URL ? 'backend' : 'zoho_fallback',
          already_subscribed: alreadySubscribed,
        });
        setSuccessMsg(
          alreadySubscribed
            ? "You're already on the list. Keep an eye on your inbox."
            : "You're on the list. Keep an eye on your inbox.",
        );
        setEmail('');

        void fetch(ZOHO_SUBMIT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ Email: trimmed }),
        }).catch(() => undefined);
      } catch (error) {
        trackEvent('waitlist_failed', { stage: 'request', transport: 'backend' });
        const message = error instanceof Error ? error.message : 'Could not join the waitlist right now.';
        setErrorMsg(message);
      } finally {
        setSubmitting(false);
      }
    },
    [email, submitted, submitting],
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${IMAGES[bgIndex]}')`,
          opacity: 0.46,
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[#0D0A06]/50" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#0D0A06_0%,rgba(13,10,6,0.88)_35%,rgba(13,10,6,0.42)_70%,rgba(13,10,6,0.75)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(0deg,#0D0A06_0%,rgba(13,10,6,0.72)_42%,transparent_100%)]" />

      <main id="top" className="relative z-10 flex-1">
        <section className="mx-auto flex min-h-dvh w-full max-w-7xl items-center px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
          <div className="max-w-3xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <img
                src={BRAND_MEDALLION}
                alt="MenRush"
                className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
                draggable={false}
              />
              <nav className="flex items-center gap-2 text-sm font-semibold">
                <Link
                  to="/login"
                  className="rounded-lg px-3.5 py-2 text-[#A89070] transition-colors hover:text-[#F0E0C0]"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg border border-[#C4832A]/45 bg-[#C4832A]/15 px-3.5 py-2 text-[#F0E0C0] transition-colors hover:bg-[#C4832A]/25"
                >
                  Sign up
                </Link>
              </nav>
            </div>

            <h1 className="font-display max-w-4xl text-5xl font-black leading-[0.92] tracking-normal text-[#F0E0C0] sm:text-7xl lg:text-8xl">
              MenRush
            </h1>
            <p className="mt-4 text-xl font-semibold text-[#C4832A] sm:text-2xl">Men. Here. Now.</p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#F0E0C0]/82 sm:text-lg">
              See who's near you right now. No swiping, no waiting. Pulse live, find rooms nearby,
              and match when the moment is actually happening.
            </p>

            <div id="waitlist" className="mt-8 max-w-2xl border-y border-[#3D2B0E]/80 bg-[#0D0A06]/42 py-5 backdrop-blur-md">
              {submitted && successMsg ? (
                <p className="text-base font-semibold text-[#C4832A]">{successMsg}</p>
              ) : (
                <form onSubmit={handleWaitlistSubmit} noValidate className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    name="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                    aria-label="Email address"
                    disabled={submitting}
                    className="min-h-12 flex-1 rounded-lg border border-[#3D2B0E] bg-[#1E1508]/72 px-4 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/55 focus:border-[#C4832A]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-12 rounded-lg bg-[#C4832A] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#0D0A06] transition-all duration-200 hover:bg-[#E0A14A] active:scale-[0.98] disabled:opacity-50 sm:whitespace-nowrap"
                  >
                    {submitting ? 'Joining…' : 'Join waitlist'}
                  </button>
                </form>
              )}

              {errorMsg && <p className="mt-3 text-sm font-medium text-[#f0a07a]">{errorMsg}</p>}
              <p className="mt-3 text-sm text-[#A89070]">
                Early members get <span className="font-semibold text-[#C4832A]">30 days Premium free</span> at launch. No card needed.
              </p>
            </div>

            <div className="mt-7 max-w-2xl rounded-lg border border-[#C4832A]/45 bg-[#1E1508]/68 p-5 backdrop-blur-md">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C4832A]">
                Update · we're nearly there
              </p>
              <p className="mt-3 text-base leading-7 text-[#F0E0C0]/88">
                Thank you for your patience. We're polishing a few last features so when
                your first MenRush meet happens, it works perfectly. Hold tight — it's
                worth the wait.
              </p>

              <div className="mt-5 border-t border-[#3D2B0E]/80 pt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C4832A]">
                  Beta 200 · one year Premium on us
                </p>
                <p className="mt-2 text-sm leading-6 text-[#F0E0C0]/82">
                  Join the waitlist now and you're in the draw — we'll pick{' '}
                  <span className="font-semibold text-[#C4832A]">200 men at random</span>{' '}
                  from the waitlist to join our Beta. At the end, Beta members answer a
                  short feedback survey. Honest, considered answers — not blanks or
                  keyboard mash — earn a code for{' '}
                  <span className="font-semibold text-[#C4832A]">
                    one full year of MenRush Premium
                  </span>
                  , attached to your account, to use whenever you're ready.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="relative z-10 border-y border-[#3D2B0E]/80 bg-[#0D0A06]/88 backdrop-blur-xl">
          <div className="mx-auto grid w-full max-w-7xl gap-px px-5 py-4 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10">
            {features.map(({ Icon, title, desc }) => (
              <div key={title} className="group flex min-h-36 flex-col justify-between border border-[#3D2B0E]/80 bg-[#1E1508]/54 p-4 transition-colors hover:border-[#C4832A]/45">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#C4832A]/12 text-[#C4832A]">
                  <Icon size={22} />
                </span>
                <div>
                  <p className="text-sm font-black text-[#F0E0C0]">{title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#A89070]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative z-10 bg-[#0D0A06] px-5 py-12 sm:px-8 lg:px-10">
          <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="font-display text-3xl font-black tracking-normal text-[#F0E0C0] sm:text-4xl">Premium arrives with launch.</p>
              <p className="mt-4 max-w-lg text-sm leading-7 text-[#A89070]">
                The free core stays direct: see who's nearby, match, message, and join rooms.
                Premium adds more reach, control, and signal when you want the room to notice.
              </p>
              <button
                onClick={handleShare}
                className="mt-6 flex items-center gap-2 rounded-lg border border-[#3D2B0E] bg-[#1E1508]/70 px-4 py-3 text-sm font-semibold text-[#A89070] backdrop-blur-md transition-all duration-200 hover:border-[#C4832A]/50 hover:text-[#F0E0C0] active:scale-[0.98]"
              >
                <ShareIcon className="h-4 w-4" />
                {copied ? 'Link copied' : 'Share with a friend'}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {premiumFeatures.map((f) => (
                <div key={f} className="flex min-h-12 items-center gap-3 border border-[#3D2B0E]/80 bg-[#1E1508]/42 px-3 py-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#C4832A]" />
                  <span className="text-sm text-[#F0E0C0]/82">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter className="relative z-10 mt-auto w-full shrink-0" />
    </div>
  );
};

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);
