import React, { useEffect, useRef, useState } from 'react';
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

function normalizeClientInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export const BetaAccess = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!BETA_INVITE_REQUIRED) {
      navigate('/register', { replace: true });
      return;
    }
    // Prefill from waitlist welcome / invite email deep links.
    try {
      const params = new URLSearchParams(window.location.search);
      const fromLink = params.get('invite') || params.get('code');
      if (fromLink) {
        setCode(normalizeClientInviteCode(fromLink));
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || loading) return;
    setError('');

    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the invite code from your beta email.');
      return;
    }

    const normalized = normalizeClientInviteCode(trimmed);
    // Codes look like MENRUSHXXXXXXXX (15 chars) after stripping hyphens/spaces.
    if (!normalized.startsWith('MENRUSH') || normalized.length !== 15) {
      setError('Use the full code from your email (e.g. MENRUSH-XXXX-XXXX). 18+ beta only.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const res = await betaAPI.validateInvite({ code: normalized });
      const validated = res.data.code ?? trimmed;
      storeInviteCode(validated);
      navigate(`/register?invite=${encodeURIComponent(validated)}`, { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response
        ?.status;
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (status === 429) {
        setError('Too many attempts. Wait a few minutes, then try again.');
      } else {
        setError(
          apiError ||
            'That invite code is invalid, expired, or already used. Check the email or join the waitlist.',
        );
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.beta} showFooter>
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

          <p className="m-0 text-sm leading-[1.55] text-[var(--cream-muted)]">
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

          <p className="m-0 text-center text-[15px] text-[var(--cream-muted)]">
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
