import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';

const BG_IMAGES = ['/bg1.png', '/bg2.png'];

const discoverySignals = [
  'Live map-based discovery',
  'Nearby matches within minutes',
  'Real-time messaging and presence',
];

const cityMoments = [
  { place: 'Shoreditch', detail: '4 people nearby right now' },
  { place: 'Camden', detail: '2 new matches in motion' },
  { place: 'Soho', detail: 'Location filters narrowing the crowd' },
];

const useRandomBgSlideshow = () => {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * BG_IMAGES.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((i) => {
          const next = Math.floor(Math.random() * BG_IMAGES.length);
          return next === i ? (i + 1) % BG_IMAGES.length : next;
        });
        setFade(true);
      }, 600);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return { src: BG_IMAGES[index], fade };
};

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { src, fade } = useRandomBgSlideshow();

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
    <div className="relative min-h-dvh overflow-hidden bg-[#0B0F17]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{ backgroundImage: `url(${src})`, opacity: fade ? 1 : 0 }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,140,255,0.26),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,107,107,0.18),transparent_25%),linear-gradient(135deg,rgba(8,11,18,0.38),rgba(8,11,18,0.72))]" />
      <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-7xl items-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <section className="max-w-2xl self-center">
            <Link
              to="/"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#F2F4F8]/72 backdrop-blur-md transition-all hover:border-white/20 hover:text-white"
            >
              NearNow
            </Link>

            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.05em] text-[#F2F4F8] sm:text-6xl lg:text-7xl">
              Sign in and step back into
              <span className="block bg-gradient-to-r from-[#F2F4F8] via-[#92beff] to-[#FFAA86] bg-clip-text text-transparent">
                location-based user discovery.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#F2F4F8]/72 sm:text-lg">
              NearNow helps you find people around you in real time, filter the map by who fits your vibe, and move from nearby discovery to actual conversation while the moment is still live.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {discoverySignals.map((signal) => (
                <div
                  key={signal}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-[#F2F4F8]/78 backdrop-blur-md"
                >
                  {signal}
                </div>
              ))}
            </div>

            <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
              {cityMoments.map((moment) => (
                <article
                  key={moment.place}
                  className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-md"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8bb6ff]">
                    {moment.place}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#F2F4F8]/78">{moment.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="w-full max-w-md lg:justify-self-end">
            <div className="p-1 sm:p-2">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8bb6ff]">
                  Welcome back
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#F2F4F8]">
                  Continue nearby.
                </h2>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/12 px-4 py-3 text-sm text-[#FFD2D2] backdrop-blur-md animate-fade-in">
                  <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#F2F4F8]/58">
                    Username / Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-2xl border border-white/18 bg-transparent px-4 py-3.5 text-sm text-[#F2F4F8] placeholder:text-[#F2F4F8]/34 focus:border-[#4F8CFF]/60 focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/25"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#F2F4F8]/58">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-2xl border border-white/18 bg-transparent px-4 py-3.5 text-sm text-[#F2F4F8] placeholder:text-[#F2F4F8]/34 focus:border-[#4F8CFF]/60 focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/25"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4F8CFF] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#3a6fe0] hover:shadow-glow-blue active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <><Spinner /> Signing in…</> : 'Sign In'}
                </button>
              </form>

              <p className="mt-5 text-sm text-[#F2F4F8]/55">
                No account yet?{' '}
                <Link to="/register" className="font-semibold text-[#8bb6ff] transition-colors hover:text-white">
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
