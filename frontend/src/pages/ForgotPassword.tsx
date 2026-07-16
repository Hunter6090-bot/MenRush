import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/client';
import { BrandMark } from '../components/BrandMark';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SiteFooter } from '../components/SiteFooter';

const SUCCESS_COPY =
  'If that email is on MenRush, we sent a reset link. Check your inbox and spam — the link expires in 1 hour.';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
      // Backend always returns ok:true when the request is accepted (email sent or no-op for unknown).
      if (res.status >= 200 && res.status < 300) {
        setSuccess(true);
        setEmail('');
        return;
      }
      setError('Could not send reset email. Please try again.');
    } catch (err: unknown) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { status?: number } }).response?.status === 'number'
          ? (err as { response: { status: number } }).response.status
          : 0;
      // Rate limit still needs a clear message.
      if (status === 429) {
        setError('Too many reset requests. Wait a few minutes, then try again.');
        return;
      }
      // Validation (bad email format) — show server message if present.
      if (status === 400) {
        const apiError =
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { error?: unknown } } }).response?.data?.error ===
            'string'
            ? (err as { response: { data: { error: string } } }).response.data.error
            : null;
        setError(apiError || 'Enter a valid email address.');
        return;
      }
      setError('Could not reach the server. Check your connection and try again.');
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
          <Link to="/login" className="inline-block transition-opacity hover:opacity-80">
            <BrandMark size="md" showWordmark />
          </Link>

          <h1 className="mr-page-heading mt-6">Forgot your password?</h1>
          <p className="mr-copy mt-3">
            Enter the email on your account and we&apos;ll send a reset link if it&apos;s registered.
          </p>

          <div className="mt-8">
            {error ? (
              <div
                role="alert"
                className="mb-4 rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-4 py-3 text-sm text-[#F0E0C0]"
              >
                {error}
              </div>
            ) : null}

            {success ? (
              <div
                role="status"
                data-testid="forgot-password-success"
                className="mb-4 rounded-2xl border border-[rgba(143,199,115,0.45)] bg-[rgba(143,199,115,0.12)] px-4 py-4 text-sm leading-relaxed text-[#F0E0C0]"
              >
                <p className="font-extrabold text-[#8FC773]">Reset email sent</p>
                <p className="mt-1.5 text-[#F0E0C0]/90">{SUCCESS_COPY}</p>
                <p className="mt-3 text-[12px] text-[#A89070]">
                  Didn&apos;t get it? Wait a minute, check spam, then try again — or email{' '}
                  <a href="mailto:support@menrush.com" className="font-semibold text-[#C4832A]">
                    support@menrush.com
                  </a>
                  .
                </p>
              </div>
            ) : null}

            {!success ? (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
                    autoComplete="email"
                    className="w-full rounded-2xl border border-[#3D2B0E] bg-[#1E1508]/40 px-4 py-3.5 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/50 focus:border-[#C4832A]/60 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C4832A] to-[#A45E18] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-[#D4943B] hover:to-[#C4832A] hover:shadow-glow-blue active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <PulseRing size={16} /> Sending…
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setError('');
                }}
                className="w-full rounded-2xl border border-[rgba(196,131,42,0.45)] py-3 text-sm font-semibold text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.1)]"
              >
                Send another link
              </button>
            )}

            <p className="mt-5 text-sm text-[#A89070]">
              Remembered it?{' '}
              <Link
                to="/login"
                className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]"
              >
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
