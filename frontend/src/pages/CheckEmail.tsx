import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
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

/**
 * Post-register face: account exists but is not live until email confirm.
 */
export const CheckEmail = () => {
  const [searchParams] = useSearchParams();
  const email = useMemo(() => searchParams.get('email')?.trim() || '', [searchParams]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleResend = async () => {
    if (!email) {
      setError('Open this page from sign up so we know which email to resend.');
      setStatus('error');
      return;
    }
    setError('');
    setStatus('sending');
    try {
      await authAPI.resendConfirm({ email });
      setStatus('sent');
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error ===
          'string'
          ? (err as { response: { data: { error: string } } }).response.data.error
          : 'Could not resend. Try again in a moment.';
      setError(msg);
      setStatus('error');
    }
  };

  return (
    <PublicAuthShell>
      <PublicAuthHero
        title="Check your"
        accent="email."
        copy="Confirm your email to finish creating your account. The link expires in 24 hours."
      />

      <div className={publicPanelClass} data-testid="check-email-panel">
        {email ? (
          <p className="m-0 text-[15px] leading-[1.6] text-[var(--cream-muted)]">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-[#F0E0C0]" data-testid="check-email-address">
              {email}
            </span>
            . Open it to continue.
          </p>
        ) : (
          <p className="m-0 text-[15px] leading-[1.6] text-[var(--cream-muted)]">
            We sent a confirmation link to your inbox. Open it to continue.
          </p>
        )}

        {error ? <p className={`${publicErrorClass} mt-4`}>{error}</p> : null}
        {status === 'sent' ? (
          <p className="mt-4 text-[14px] text-[#C4832A]" data-testid="check-email-resent">
            If that email needs confirmation, we sent a new link. Check inbox and spam.
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleResend}
          disabled={status === 'sending'}
          className={`${publicPrimaryButtonClass} mt-6`}
          data-testid="check-email-resend"
        >
          {status === 'sending' ? (
            <>
              <PulseRing size={16} /> Sending…
            </>
          ) : (
            'Resend confirmation'
          )}
        </button>

        <p className="mt-5 m-0 text-center text-[15px] text-[var(--cream-muted)]">
          Already confirmed?{' '}
          <Link to="/login" className={publicLinkClass}>
            Sign in
          </Link>
        </p>
      </div>
    </PublicAuthShell>
  );
};
