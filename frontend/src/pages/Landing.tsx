import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';
import { authAPI } from '../api/client';
import { CoinFlip } from '../components/CoinFlip';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SiteFooter } from '../components/SiteFooter';

const stats = [
  { value: '5 km', label: 'Discovery radius' },
  { value: '1 tap', label: 'Match to message' },
  { value: 'Live', label: 'Real-time presence' },
];

export const Landing = () => {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/discover" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      setAuth(res.data.user, res.data.token);
      navigate('/discover');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-[#F0E0C0]">
      <RandomBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />

      {/* Header */}
      <header className="relative z-10 flex flex-shrink-0 items-center justify-between px-5 pt-4 pb-2 sm:px-8 lg:px-10">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <CoinFlip qrValue="https://menrush.com" sizeClass="h-28" noFlip />
        </Link>
        <Link
          to="/register"
          className="rounded-full bg-gradient-to-r from-[#C4832A] to-[#8B4513] px-5 py-2.5 text-sm font-semibold text-[#F0E0C0] transition-all hover:from-[#D4943B] hover:to-[#9B5523]"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.5)' }}
        >
          Join now
        </Link>
      </header>

      {/* Main content: two columns on lg, stacked on mobile */}
      <main className="relative z-10 flex flex-1 items-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1fr_420px] lg:items-center">

          {/* Left: Hero */}
          <section className="text-center lg:text-left">
            <h1 className="text-5xl font-black leading-[0.92] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Guys nearby now.
            </h1>

            <p className="mt-5 max-w-md text-base leading-7 text-[#F0E0C0]/72 sm:text-lg lg:max-w-none">
              A real-time discovery app for gay, bi, trans, discreet and curious men.
              Verified profiles, live proximity, direct chat.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              {stats.map((stat, i) => (
                <div key={stat.label} className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black tracking-tight text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>{stat.value}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-[#F0E0C0]/55">{stat.label}</p>
                  </div>
                  {i < stats.length - 1 && <div className="h-8 w-px bg-white/15" />}
                </div>
              ))}
            </div>
          </section>

          {/* Right: Login form */}
          <section aria-label="Sign in">
            <div className="rounded-3xl border border-[#3D2B0E] bg-[#1E1508]/60 p-6 backdrop-blur-md sm:p-8">

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90 backdrop-blur-md"
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#A89070]">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-2xl border border-[#C4832A]/26 bg-[#F7EFE0] px-4 py-3.5 text-sm font-semibold text-[#2A1C0A] placeholder:text-[#8B6B42]/70 focus:border-[#C4832A]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/30"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#A89070]">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-[#C4832A]/26 bg-[#F7EFE0] px-4 py-3.5 text-sm font-semibold text-[#2A1C0A] placeholder:text-[#8B6B42]/70 focus:border-[#C4832A]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#D4943B] hover:to-[#9B5523] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <><PulseRing size={16} /> Logging in…</> : 'Login'}
                </button>
              </form>

              <p className="mt-5 text-sm text-[#A89070]">
                No account yet?{' '}
                <Link to="/register" className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]">
                  Create one — it's free
                </Link>
              </p>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
