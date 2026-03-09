import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';

const BG_IMAGES = ['/bg1.png', '/bg2.png'];

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

export const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', age: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.register({ ...form, age: parseInt(form.age) });
      setAuth(res.data.user, res.data.token);
      navigate('/discover');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { src, fade } = useRandomBgSlideshow();

  const inputClass =
    'w-full bg-white/[0.06] border border-white/[0.08] text-[#F2F4F8] placeholder:text-[#F2F4F8]/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF]/50 transition-all duration-200';

  const labelClass = 'block text-xs font-medium text-[#F2F4F8]/50 mb-1.5 uppercase tracking-wide';

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background slideshow */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{ backgroundImage: `url(${src})`, opacity: fade ? 1 : 0 }}
      />
      {/* Dark overlay for legibility */}
      <div className="absolute inset-0 bg-black/55" />

      <div className="w-full max-w-sm relative z-10 animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight text-[#F2F4F8]">
            Near<span className="text-[#4F8CFF]">&</span>Now
          </h1>
          <p className="text-[#F2F4F8]/40 mt-2 text-sm">Join the community</p>
        </div>

        <div className="bg-[#1A1D23]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-card">
          <h2 className="text-lg font-bold text-[#F2F4F8] mb-5">Create account</h2>

          {error && (
            <div className="flex items-start gap-2.5 bg-[#FF6B6B]/10 border border-[#FF6B6B]/25 text-[#FF6B6B] px-4 py-3 rounded-xl mb-4 text-sm animate-fade-in">
              <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Alex Smith"
                required
                minLength={2}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Age</label>
                <input
                  type="number"
                  value={form.age}
                  onChange={set('age')}
                  placeholder="25"
                  min="18"
                  max="120"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min 8 chars"
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-xl bg-[#4F8CFF] hover:bg-[#3a6fe0] disabled:opacity-50 text-white font-semibold text-sm transition-all duration-200 hover:shadow-glow-blue active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner /> Creating account…</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-5 text-xs text-[#F2F4F8]/35">
            Already have an account?{' '}
            <Link to="/login" className="text-[#4F8CFF] hover:text-[#3a6fe0] font-semibold transition-colors">
              Sign In
            </Link>
          </p>
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
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);
