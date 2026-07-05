import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { betaAPI } from '../api/client';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { PulseRing } from '../components/PulseRing';
import { BETA_INVITE_REQUIRED, storeInviteCode } from '../lib/betaInvite';
import {
  publicCodeInputClass,
  publicErrorClass,
  publicLabelCopperClass,
  publicLinkClass,
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
    <PublicAuthShell
      backgroundImage={AUTH_BACKGROUNDS.beta}
      coinFlip={{ qrValue: 'https://menrush.com/beta' }}
      showFooter
    >
      <PublicAuthHero
        title="Beta access is"
        accent="invite-only."
        copy="MenRush hasn't launched publicly yet. If you were selected for beta, enter the unique code from your invite email below."
      />

      <div className={publicPanelClass}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2.5">
            <label htmlFor="beta-invite-code" className={publicLabelCopperClass}>
              Beta invite code
            </label>
            <input
              id="beta-invite-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="E.g. MR-BETA-XXXX"
              autoComplete="off"
              spellCheck={false}
              required
              className={publicCodeInputClass}
            />
          </div>

          {error ? <p className={publicErrorClass}>{error}</p> : null}

          <p className="m-0 text-sm leading-[1.55] text-[#A89070]">
            Codes are single-use and tied to selected waitlist members. No code?{' '}
            <Link to="/coming-soon#waitlist" className={publicLinkClass}>
              Join the waitlist
            </Link>
            .
          </p>

          <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
            {loading ? (
              <>
                <PulseRing size={16} /> Checking code…
              </>
            ) : (
              'Continue'
            )}
          </button>

          <p className="m-0 text-center text-[15px] text-[#A89070]">
            Already have an account?{' '}
            <Link to="/login" className={publicLinkClass}>
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </PublicAuthShell>
  );
};
