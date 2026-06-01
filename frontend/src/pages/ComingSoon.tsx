import { useState, useCallback, type FormEvent } from 'react';
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

const WAITLIST_API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/waitlist`;
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
        setErrorMsg('Please enter a valid email address.');
        return;
      }

      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
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

        setSubmitted(true);
        setSuccessMsg(
          data?.already_subscribed
            ? "You're already on the list. Keep an eye on your inbox."
            : "You're on the list. Your welcome email is queued.",
        );
        setEmail('');

        void fetch(ZOHO_SUBMIT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ Email: trimmed }),
        }).catch(() => undefined);
      } catch (error) {
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

      <header className="relative z-20 border-b border-[#3D2B0E]/70 bg-[#0D0A06]/72 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="#top" className="flex items-center transition-opacity hover:opacity-85" aria-label="MenRush home">
            <img
              src={BRAND_MEDALLION}
              alt="MenRush"
              className="h-10 w-10 rounded-full object-cover"
              draggable={false}
            />
          </a>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <a href="/login" className="rounded-lg border border-[#3D2B0E] bg-[#1E1508]/70 px-3.5 py-2 text-[#F0E0C0] transition-colors hover:border-[#C4832A]/50">
              Sign in
            </a>
            <a href="/register" className="rounded-lg bg-[#C4832A] px-3.5 py-2 font-bold text-[#0D0A06] transition-colors hover:bg-[#D4943B]">
              Sign up
            </a>
          </nav>
        </div>
      </header>

      <main id="top" className="relative z-10 flex-1">
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-10 lg:py-14">
          <div className="max-w-3xl">
            <div className="mb-8 flex items-center">
              <img
                src={BRAND_MEDALLION}
                alt="MenRush"
                className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
                draggable={false}
              />
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
                    {submitting ? 'Joining…' : 'Get early access'}
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
                  Sign up now and you're in the draw — we'll pick{' '}
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

          <aside className="w-full max-w-[420px] justify-self-center lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#3D2B0E] bg-[#120D08]/88 p-3 shadow-[0_22px_80px_rgba(0,0,0,0.72)] backdrop-blur-xl">
              <div className="rounded-[20px] border border-[#3D2B0E] bg-[#0D0A06]">
                <div className="flex h-12 items-center justify-between border-b border-[#3D2B0E] px-4">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[#C4832A]">Nearby live</span>
                  <span className="rounded-full bg-[#6FA85A]/16 px-2.5 py-1 text-[11px] font-bold text-[#92C47F]">24 online</span>
                </div>

                <div className="relative h-[360px] overflow-hidden bg-[#14100A]">
                  <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(196,131,42,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(196,131,42,0.12)_1px,transparent_1px)] [background-size:38px_38px]" />
                  <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C4832A]/30" />
                  <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C4832A]/40" />
                  <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#F0E0C0] bg-[#C4832A] shadow-[0_0_0_10px_rgba(196,131,42,0.16)]" />

                  {[
                    { name: 'Kai', meta: '320m', x: '16%', y: '22%' },
                    { name: 'Milo', meta: '0.8 km', x: '58%', y: '18%' },
                    { name: 'Ash', meta: '1.2 km', x: '65%', y: '58%' },
                    { name: 'Ren', meta: '2 km', x: '22%', y: '68%' },
                  ].map((person) => (
                    <div
                      key={person.name}
                      className="absolute flex items-center gap-2 rounded-full border border-[#3D2B0E] bg-[#1E1508]/92 py-1 pl-1 pr-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                      style={{ left: person.x, top: person.y }}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C4832A] text-xs font-black text-[#0D0A06]">
                        {person.name[0]}
                      </span>
                      <span>
                        <span className="block text-xs font-black text-[#F0E0C0]">{person.name}</span>
                        <span className="block text-[10px] font-bold text-[#C4832A]">{person.meta}</span>
                      </span>
                    </div>
                  ))}

                  <button className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#C4832A] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#0D0A06] shadow-[0_10px_34px_rgba(196,131,42,0.32)]">
                    <IconPulse size={18} />
                    Pulse now
                  </button>
                </div>

                <div className="grid grid-cols-3 divide-x divide-[#3D2B0E] border-t border-[#3D2B0E]">
                  {[
                    ['8', 'Matches'],
                    ['3', 'Rooms'],
                    ['12', 'Messages'],
                  ].map(([value, label]) => (
                    <div key={label} className="px-3 py-4 text-center">
                      <span className="block text-xl font-black text-[#F0E0C0]">{value}</span>
                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#A89070]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
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
