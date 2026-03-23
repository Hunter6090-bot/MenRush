import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { CoinFlip } from '../components/CoinFlip';

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
      navigate('/discover');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/bg2.png)' }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-7xl items-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <section className="max-w-2xl self-center">
            <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
              <CoinFlip qrValue="https://nearnow.app" sizeClass="h-40" />
            </Link>

            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.05em] text-[#F0E0C0] sm:text-6xl lg:text-7xl">
              Sign in and step back into
              <span className="block bg-gradient-to-r from-[#F0E0C0] via-[#C4832A] to-[#8B4513] bg-clip-text text-transparent">
                location-based user discovery.
              </span>
            </h1>


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
            <div className="bg-transparent p-1 sm:p-2">
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90 backdrop-blur-md animate-fade-in">
                  <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#A89070]">
                    Username / Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/40 px-4 py-3.5 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/50 focus:border-[#C4832A]/60 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#A89070]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/40 px-4 py-3.5 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/50 focus:border-[#C4832A]/60 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#D4943B] hover:to-[#9B5523] hover:shadow-glow-blue active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <><Spinner /> Signing in…</> : 'Sign In'}
                </button>
              </form>

              <p className="mt-5 text-sm text-[#A89070]">
                No account yet?{' '}
                <Link to="/register" className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]">
                  Create one
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);
