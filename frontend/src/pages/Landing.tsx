import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';
import { CoinFlip } from '../components/CoinFlip';

const stats = [
  { value: '5km', label: 'Discovery radius' },
  { value: '1 tap', label: 'Match to message' },
  { value: 'Live', label: 'Real-time presence' },
];

export const Landing = () => {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Navigate to="/discover" replace />;
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-[#F0E0C0]">

      {/* Full-screen background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/bg2.png)' }}
      />

      {/* Gradient overlay — dark at top & bottom, lighter in center */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/45 to-black/90" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />

      {/* Bottom gradient strip — ensures stats row is always readable */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* ── Header ── */}
      <header className="relative z-10 flex flex-shrink-0 items-center justify-between px-5 pt-4 pb-2 sm:px-8 lg:px-10">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <CoinFlip qrValue="https://nearnow.app" sizeClass="h-14" />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-[#F0E0C0]/85 backdrop-blur-sm transition-all hover:border-white/40 hover:text-white"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-gradient-to-r from-[#C4832A] to-[#8B4513] px-5 py-2.5 text-sm font-semibold text-[#F0E0C0] transition-all hover:from-[#D4943B] hover:to-[#9B5523]"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.5)' }}
          >
            Join now
          </Link>
        </div>
      </header>

      {/* ── Hero — fills remaining viewport, content centered within it ── */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-4 text-center sm:px-8">

        {/* Badge sits directly above h1 */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C4832A]/30 bg-[#C4832A]/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#D4943B] backdrop-blur-sm">
          Location-first social discovery
        </div>

        <h1 className="max-w-4xl text-6xl font-black leading-[0.92] tracking-[-0.04em] sm:text-7xl lg:text-8xl">
          Meet people who are
          <span className="block bg-gradient-to-r from-[#F0E0C0] via-[#D4943B] to-[#9B5523] bg-clip-text text-transparent">
            nearby right now.
          </span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-[#F0E0C0]/65 sm:text-lg">
          Real-time proximity. Direct messaging. No algorithms — just the people around you.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#C4832A] to-[#8B4513] px-8 py-4 text-base font-semibold text-[#F0E0C0] transition-all hover:from-[#D4943B] hover:to-[#9B5523] hover:-translate-y-0.5"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.5)' }}
          >
            Join Now — It's Free
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/[0.07] px-8 py-4 text-base font-semibold text-[#F0E0C0] backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/[0.13]"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.4)' }}
          >
            Sign In
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-black tracking-tight text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>{stat.value}</p>
                <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-[#F0E0C0]/55">{stat.label}</p>
              </div>
              {i < stats.length - 1 && (
                <div className="h-8 w-px bg-white/15" />
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
