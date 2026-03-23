import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { CoinFlip } from '../components/CoinFlip';

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

  const inputClass =
    'w-full bg-[#1E1508]/60 border border-[#3D2B0E] text-[#F0E0C0] placeholder:text-[#A89070]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4832A]/50 focus:border-[#C4832A]/50 transition-all duration-200';

  const labelClass = 'block text-xs font-medium text-[#A89070] mb-1.5 uppercase tracking-wide';

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/bg1.png)' }}
    >
      {/* Dark overlay for legibility */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="w-full max-w-sm relative z-10 animate-slide-up">
        <div className="flex justify-center mb-8">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <CoinFlip qrValue="https://nearnow.app" sizeClass="h-40" />
          </Link>
        </div>

        <div className="bg-[#1E1508]/80 backdrop-blur-xl border border-[#3D2B0E] rounded-2xl p-6 shadow-card">
          <h2 className="text-lg font-bold text-[#F0E0C0] mb-5">Create account</h2>

          {error && (
            <div className="flex items-start gap-2.5 bg-[#8B4513]/10 border border-[#8B4513]/25 text-[#F0E0C0]/90 px-4 py-3 rounded-xl mb-4 text-sm animate-fade-in">
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
              className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-semibold text-sm transition-all duration-200 hover:shadow-glow-blue active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner /> Creating account…</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-5 text-xs text-[#A89070]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#C4832A] hover:text-[#D4943B] font-semibold transition-colors">
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
