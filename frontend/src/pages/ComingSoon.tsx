import { useState, useEffect, useCallback } from 'react';
import { SiteFooter } from '../components/SiteFooter';

const LAUNCH_DATE = new Date('2026-06-01T00:00:00Z');

const IMAGES = [
  // Pride parades – USA
  'https://upload.wikimedia.org/wikipedia/commons/8/87/SF_Pride_1993.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/4/45/1991SFPrideKodak5095Gold100-2Film_0017_-_Queer_Youth_%289852371234%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/a/ae/Los_Angeles_Pride_1995_003.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/5/50/Dallas_Pride_Parade.JPG',
  'https://upload.wikimedia.org/wikipedia/commons/8/8d/42nd_Baltimore_Gay_Pride_Block_Party.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/3/38/DC_Gay_Pride_-_Parade_-_2010-06-12_-_060_%286250148131%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/2/2d/Capital_Pride_Festival_DC_2014_%2814372375396%29.jpg',
  // Parties & clubs
  'https://upload.wikimedia.org/wikipedia/commons/f/fa/2022.06.10_Capital_Pride_RIOT_Official_Opening_Party%2C_Washington%2C_DC_USA_161_234257_%2852144510089%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/4/4a/2022.06.09_Capital_Pride_Rooftop_Pool_Party%2C_Washington%2C_DC_USA_160_155257_%2852137114381%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/2/2e/2021.07.05_Pool_Days%2C_Washington%2C_DC_USA_186_64261-Edit.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/8/8d/Wonderland_Houston_2013_%289164803810%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/e/e7/Milwaukee_August_2024_033_%28DIX_Milwaukee%29.jpg',
  // Leather & bears
  'https://upload.wikimedia.org/wikipedia/commons/d/da/WoofCamp_2014_groupshot.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/2/26/DJAAcosta01.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/2/2e/Bear_Dore_Alley.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/c/c9/Dore_Alley_Fair_%28202578729%29.jpg',
  // Muscle & daddies
  'https://upload.wikimedia.org/wikipedia/commons/7/70/Alex_Carneiro.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/f/f0/FantasyFest1-125.jpg',
  // Couples & kisses
  'https://upload.wikimedia.org/wikipedia/commons/0/04/Kiss_-_Hiro_at_the_Maritime_Hotel.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/c/cd/Gay_Couple_Savv_and_Pueppi_02.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/9/93/Coppia_al_Gay_Pride_di_Milano_2008_4_-_Foto_Giovanni_Dall%27Orto%2C_7-June-2008_3.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/e/ef/Almost_a_waltz_-_Foto_di_Giovanni_Dall%27Orto_-_5_Agosto_2011.jpg',
  // Your photos – Sitges & events
  '/images/photo1.png',
  '/images/photo2.png',
  // International
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
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      {/* Background image slideshow */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${IMAGES[bgIndex]}')`,
          opacity: 0.6,
        }}
      />

      {/* Dark overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[#0D0A06]/35" />

      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_20%,rgba(196,131,42,0.12),transparent)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-12 sm:py-20">

        {/* Medallion pair — front (existing logo) + reverse (new) */}
        <div className="mb-6 flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-4">
            <img
              src="https://menrush.com/menrush-logo.png"
              alt="MenRush front medallion"
              className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
              style={{ boxShadow: '0 4px 32px rgba(196,131,42,0.4)' }}
            />
            <img
              src="/brand/medallion-reverse.png"
              alt="MenRush reverse medallion"
              className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32 animate-pulse-breathe"
              style={{ boxShadow: '0 4px 32px rgba(196,131,42,0.55)' }}
            />
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-[#A89070]">
            Coming Soon
          </span>
        </div>

        {/* Tagline */}
        <h1 className="mb-2 text-center text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">
          <span className="bg-gradient-to-r from-[#C4832A] to-[#E8A04A] bg-clip-text text-transparent">
            Pulse for now.
          </span>{' '}
          Match for later.
        </h1>
        <p className="mb-1 text-center text-sm font-medium text-[#A89070]">
          See who's near you right now. No swiping, no waiting.
        </p>
        <p
          className="mb-10 text-center text-[10px] font-medium uppercase tracking-[0.22em]"
          style={{ color: 'var(--copper-dark, #8C5E1F)', fontFamily: 'var(--font-serif, Georgia)' }}
        >
          VIRI · HIC · NVNC — Men. Here. Now.
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
          <iframe
            aria-label="MenRush.com"
            frameBorder="0"
            style={{ height: '500px', width: '100%', border: 'none' }}
            src="https://forms.zoho.com/hellomen1/form/MenRushcom/formema/ridAzzP0GwTafugVKgaUQtHXDojK1z_jZpTDjtAor4"
          />
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

      <SiteFooter className="relative z-10 mt-auto w-full shrink-0" />
    </div>
  );
};

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);
