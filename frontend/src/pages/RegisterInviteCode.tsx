import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { CoinFlip } from '../components/CoinFlip';
import { PublicHeroBlock, PublicMarketingShell } from '../components/PublicMarketingShell';
import { PulseRing } from '../components/PulseRing';
import { saveValidatedBetaInviteCode } from '../lib/betaInvite';
import {
  publicHeroLogoClass,
  publicInputClass,
  publicLabelClass,
  publicNavLinkSecondary,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';

export const RegisterInviteCode = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the beta invite code from your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.validateBetaInviteCode({ code: trimmed });
      const normalized = String(res.data.code || trimmed).trim().toUpperCase();
      saveValidatedBetaInviteCode(normalized);

      if (res.data.registration_open) {
        navigate('/register/create');
        return;
      }

      setSuccess(
        res.data.message ||
          "You're selected for beta. Account creation isn't open yet — we'll email you when your code can be used.",
      );
      setCode('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 404) {
        setError('Beta invite checks are not live yet. Please try again closer to launch.');
        return;
      }
      const message =
        axiosErr.response?.data?.error ||
        'That code is not recognized. Beta access is invite-only.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicMarketingShell
      header={
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link to="/login" className={publicNavLinkSecondary}>
            Sign in
          </Link>
          <Link to="/" className={publicNavLinkSecondary}>
            Waitlist
          </Link>
        </nav>
      }
      hero={
        <>
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
            <CoinFlip qrValue="https://menrush.com" sizeClass={publicHeroLogoClass} noFlip />
          </Link>
          <PublicHeroBlock
            title="Beta access is"
            accent="invite-only."
            copy="MenRush hasn't launched publicly yet. If you were selected for beta, enter the unique code from your invite email below."
          />
        </>
      }
      panel={
        <div className={publicPanelClass}>
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90 backdrop-blur-md animate-fade-in">
              <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-2xl border border-[#C4832A]/30 bg-[#C4832A]/10 px-4 py-3 text-sm text-[#F0E0C0]/90 backdrop-blur-md animate-fade-in">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="beta-invite-code" className={publicLabelClass}>
                Beta invite code
              </label>
              <input
                id="beta-invite-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. MR-BETA-XXXX"
                autoComplete="off"
                spellCheck={false}
                required
                className={`${publicInputClass} font-mono tracking-wide uppercase`}
              />
              <p className="mt-2 text-xs leading-snug text-[#A89070]/80">
                Codes are single-use and tied to selected waitlist members. No code?{' '}
                <Link to="/" className="text-[#C4832A] hover:text-[#D4943B]">
                  Join the waitlist
                </Link>
                .
              </p>
            </div>

            <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
              {loading ? (
                <>
                  <PulseRing size={16} /> Checking code…
                </>
              ) : (
                'Continue'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#A89070]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]">
              Sign in
            </Link>
          </p>
        </div>
      }
    />
  );
};

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
