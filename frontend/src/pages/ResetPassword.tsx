import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { CoinFlip } from '../components/CoinFlip';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SiteFooter } from '../components/SiteFooter';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Reset link is missing or invalid. Request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword({ token, password });
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 mx-auto flex min-h-0 flex-1 w-full max-w-lg items-center px-5 py-8 sm:px-8">
        <section className="w-full">
          <Link to="/login" className="inline-block hover:opacity-80 transition-opacity">
            <CoinFlip qrValue="https://menrush.com" sizeClass="h-20" noFlip />
          </Link>

          <h1 className="mr-page-heading mt-6">
            Choose a new password
          </h1>
          <p className="mr-copy mt-3">
            Enter a new password for your MenRush account.
          </p>

          <div className="mt-8">
            {error && (
              <div className="mb-4 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90">
                {error}
              </div>
            )}

            {!token ? (
              <p className="text-sm text-[#A89070]">
                This reset link is invalid.{' '}
                <Link to="/forgot-password" className="font-semibold text-[#C4832A] hover:text-[#D4943B]">
                  Request a new one
                </Link>
                .
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#A89070]">
                    New password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/40 px-4 py-3.5 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/50 focus:border-[#C4832A]/60 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#A89070]">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/40 px-4 py-3.5 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/50 focus:border-[#C4832A]/60 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#D4943B] hover:to-[#9B5523] hover:shadow-glow-blue active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <><PulseRing size={16} /> Updating…</> : 'Update password'}
                </button>
              </form>
            )}

            <p className="mt-5 text-sm text-[#A89070]">
              <Link to="/login" className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]">
                Back to sign in
              </Link>
            </p>
          </div>
        </section>
      </div>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};
