import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/client';
import { BrandMark } from '../components/BrandMark';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SiteFooter } from '../components/SiteFooter';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword({ email });
      setSuccess(res.data.message || 'If that email is registered, we sent a password reset link.');
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send reset email. Please try again.');
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
            <BrandMark size="md" showWordmark />
          </Link>

          <h1 className="mr-page-heading mt-6">
            Forgot your password?
          </h1>
          <p className="mr-copy mt-3">
            Enter the email on your account and we&apos;ll send a reset link if it&apos;s registered.
          </p>

          <div className="mt-8">
            {error && (
              <div className="mb-4 rounded-2xl border border-[#A45E18]/30 bg-[#A45E18]/12 px-4 py-3 text-sm text-[#F0E0C0]/90">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-2xl border border-[#C4832A]/30 bg-[#C4832A]/10 px-4 py-3 text-sm text-[#F0E0C0]/90">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#A89070]">
                  Email
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

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C4832A] to-[#A45E18] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#D4943B] hover:to-[#C4832A] hover:shadow-glow-blue active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <><PulseRing size={16} /> Sending…</> : 'Send reset link'}
              </button>
            </form>

            <p className="mt-5 text-sm text-[#A89070]">
              Remembered it?{' '}
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
