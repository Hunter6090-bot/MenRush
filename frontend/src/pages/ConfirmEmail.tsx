import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import {
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { PulseRing } from '../components/PulseRing';
import {
  publicErrorClass,
  publicLinkClass,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';

type ConfirmState = 'loading' | 'success' | 'already' | 'error';

/**
 * Lands from the confirm-email CTA. Confirms once; welcome is sent server-side.
 */
export const ConfirmEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
  const [state, setState] = useState<ConfirmState>(token ? 'loading' : 'error');
  const [error, setError] = useState(token ? '' : 'Confirmation link is missing or invalid.');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await authAPI.confirmEmail({ token });
        if (cancelled) return;
        if (res.data.alreadyConfirmed) {
          setState('already');
          return;
        }
        if (res.data.token && res.data.user) {
          setAuth(res.data.user, res.data.token);
          setState('success');
          navigate('/profile/setup', { replace: true });
          return;
        }
        setState('already');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error ===
            'string'
            ? (err as { response: { data: { error: string } } }).response.data.error
            : 'Could not confirm. The link may have expired.';
        setError(msg);
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, setAuth, navigate]);

  return (
    <PublicAuthShell>
      <PublicAuthHero
        title="Confirm your"
        accent="email."
        copy="Finishing your MenRush account."
      />

      <div className={publicPanelClass} data-testid="confirm-email-panel">
        {state === 'loading' ? (
          <p className="m-0 flex items-center gap-2 text-[15px] text-[var(--cream-muted)]">
            <PulseRing size={16} /> Confirming…
          </p>
        ) : null}

        {state === 'success' ? (
          <p className="m-0 text-[15px] text-[var(--cream-muted)]" data-testid="confirm-email-success">
            Email confirmed. Taking you in…
          </p>
        ) : null}

        {state === 'already' ? (
          <>
            <p className="m-0 text-[15px] text-[var(--cream-muted)]" data-testid="confirm-email-already">
              Email already confirmed. You can sign in.
            </p>
            <Link to="/login" className={`${publicPrimaryButtonClass} mt-6 inline-flex`}>
              Sign in
            </Link>
          </>
        ) : null}

        {state === 'error' ? (
          <>
            {error ? <p className={publicErrorClass}>{error}</p> : null}
            <p className="mt-4 m-0 text-[15px] text-[var(--cream-muted)]">
              Request a new link from sign up, or{' '}
              <Link to="/register" className={publicLinkClass}>
                create an account
              </Link>
              .
            </p>
            <p className="mt-4 m-0 text-center text-[15px] text-[var(--cream-muted)]">
              <Link to="/login" className={publicLinkClass}>
                Back to sign in
              </Link>
            </p>
          </>
        ) : null}
      </div>
    </PublicAuthShell>
  );
};
