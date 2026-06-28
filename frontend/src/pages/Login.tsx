import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { CoinFlip } from '../components/CoinFlip';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SiteFooter } from '../components/SiteFooter';

const cityMoments = [
  { place: 'Shoreditch', detail: '4 people nearby right now' },
  { place: 'Camden', detail: '2 new matches in motion' },
  { place: 'Soho', detail: 'Location filters narrowing the crowd' },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      setAuth(res.data.user, res.data.token);
      if (res.data.user?.is_verified) {
        navigate('/discover');
      } else if (res.data.user?.verification_status === 'pending') {
        navigate('/verify/pending');
      } else {
        navigate('/verify');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/60" />

      <header className="relative z-20 flex h-16 shrink-0 items-center justify-end px-5 sm:px-8 lg:px-10">
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link
            to="/register"
            className="rounded-lg border border-[#C4832A]/45 bg-[#C4832A]/15 px-3.5 py-2 font-bold text-[#F0E0C0] transition-colors hover:bg-[#C4832A]/25"
          >
            Sign up
          </Link>
          <Link
            to="/coming-soon#waitlist"
            className="rounded-lg border border-[#3D2B0E] bg-[#1E1508]/68 px-3.5 py-2 font-bold text-[#A89070] transition-colors hover:border-[#C4832A]/45 hover:text-[#F0E0C0]"
          >
            Waitlist
          </Link>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 flex-1 w-full max-w-7xl items-center px-5 py-6 sm:px-8 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <section className="max-w-2xl self-center">
            <Link to="/login" className="inline-block hover:opacity-80 transition-opacity">
              <CoinFlip qrValue="https://menrush.com" sizeClass="h-24" noFlip />
            </Link>

            <h1 className="mr-hero-heading mt-7">
              Sign in and see who&apos;s
              <span className="mr-hero-accent">near you right now.</span>
            </h1>

            <p className="mr-copy mt-5 max-w-2xl">
              New here? Create an account, then verify with a government ID and matching selfie
              before you can discover or chat.
            </p>


            <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
              {cityMoments.map((moment) => (
                <article
                  key={moment.place}
                  className="rounded-[1.4rem] border border-[#3D2B0E] bg-[#1E1508]/50 p-4 backdrop-blur-md"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C4832A]">
                    {moment.place}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#F0E0C0]/78">{moment.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="w-full max-w-md lg:justify-self-end">
            <div className="rounded-[1.25rem] border border-[#C4832A]/22 bg-[#0D0A06]/72 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-6">
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90 backdrop-blur-md animate-fade-in">
                  <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#F0E0C0]/82">
                    Username / Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-2xl border border-[#C4832A]/26 bg-[#F7EFE0] px-4 py-3.5 text-sm font-semibold text-[#2A1C0A] placeholder:text-[#8B6B42]/70 focus:border-[#C4832A]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/30"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#F0E0C0]/82">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-2xl border border-[#C4832A]/26 bg-[#F7EFE0] px-4 py-3.5 text-sm font-semibold text-[#2A1C0A] placeholder:text-[#8B6B42]/70 focus:border-[#C4832A]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#D4943B] hover:to-[#9B5523] hover:shadow-glow-blue active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <><PulseRing size={16} /> Signing in…</> : 'Sign In'}
                </button>
              </form>

              <div className="mt-5 flex flex-col gap-3 text-sm text-[#F0E0C0]/72 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  New here?{' '}
                  <Link to="/register" className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]">
                    Create an account
                  </Link>
                </p>
                <Link
                  to="/forgot-password"
                  className="shrink-0 font-medium text-[#C4832A] transition-colors hover:text-[#D4943B]"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
