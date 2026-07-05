import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { betaAPI } from '../api/client';
import { CoinFlip } from '../components/CoinFlip';
import { PublicHeroBlock, PublicMarketingShell } from '../components/PublicMarketingShell';
import { PulseRing } from '../components/PulseRing';
import { BETA_INVITE_REQUIRED, storeInviteCode } from '../lib/betaInvite';
import {
  publicHeroLogoClass,
  publicInputClass,
  publicLabelClass,
  publicNavLinkPrimary,
  publicNavLinkSecondary,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';

export const BetaAccess = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!BETA_INVITE_REQUIRED) {
      navigate('/register', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the invite code from your beta email.');
      return;
    }

    setLoading(true);
    try {
      const res = await betaAPI.validateInvite({ code: trimmed });
      const validated = res.data.code ?? trimmed;
      storeInviteCode(validated);
      navigate(`/register?invite=${encodeURIComponent(validated)}`, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'That invite code did not work. Check it and try again.');
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
          <Link to="/coming-soon#waitlist" className={publicNavLinkPrimary}>
            Waitlist
          </Link>
        </nav>
      }
      hero={
        <>
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
            <CoinFlip qrValue="https://menrush.com/beta" sizeClass={publicHeroLogoClass} />
          </Link>
          <PublicHeroBlock
            title="Beta access"
            accent="invite code required."
            copy="MenRush is in a closed beta. Enter the code from your invite email to create an account."
            footerNote={
              <>
                No code yet?{' '}
                <Link to="/coming-soon#waitlist" className="font-semibold text-[#C4832A] hover:text-[#D4943B]">
                  Join the waitlist
                </Link>
                .
              </>
            }
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="beta-invite-code" className={publicLabelClass}>
                Invite code
              </label>
              <input
                id="beta-invite-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="MENRUSH-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
                required
                className={`${publicInputClass} font-mono tracking-wide`}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-[#A89070]/70">
                Codes are single-use. Paste exactly as shown in your email.
              </p>
            </div>

            <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
              {loading ? (
                <>
                  <PulseRing size={16} /> Checking code…
                </>
              ) : (
                'Continue to sign up'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#A89070]">
            Already verified?{' '}
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
