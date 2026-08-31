import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { verifyAPI } from '../api/verify';
import { useAuthStore } from '../hooks/store';
import { useSocket } from '../hooks/useSocket';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import {
  publicErrorClass,
  publicMutedCopyClass,
  publicPanelClass,
  publicPrimaryButtonClass,
  publicSecondaryButtonClass,
} from '../lib/publicStyles';
import { FEATURES } from '../lib/featureFlags';

/**
 * Post-signup Veriff identity step: government ID scan + live selfie.
 * sessionUrl comes from the backend; badge only after decision webhook approval.
 */
export const VerifyVeriff: React.FC = () => {
  const navigate = useNavigate();
  const setVerified = useAuthStore((s) => s.setVerified);
  const socket = useSocket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const autoStarted = React.useRef(false);

  useEffect(() => {
    let cancelled = false;
    verifyAPI
      .veriffConfigured()
      .then((res) => {
        if (!cancelled) setConfigured(res.data.configured);
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onDecision = (payload: { decision?: string; is_verified?: boolean }) => {
      if (payload?.is_verified) {
        setVerified('verified', true);
        navigate('/profile/setup', { replace: true });
        return;
      }
      if (payload?.decision === 'declined') {
        navigate('/verify/rejected', { replace: true });
      }
    };
    socket.on('verify:decision', onDecision);
    return () => {
      socket.off('verify:decision', onDecision);
    };
  }, [socket, setVerified, navigate]);

  const launchSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyAPI.createVeriffSession();
      const url = res.data.sessionUrl;
      if (!url) throw new Error('missing_session_url');
      // Hosted Veriff flow (ID + selfie). Web uses sessionUrl; React Native uses
      // VeriffSdk.launchVeriff({ sessionUrl }) from mobile/@veriff/react-native-sdk.
      window.location.assign(url);
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'veriff_not_configured') {
        setError('Identity verification is not configured yet. You can continue and verify later.');
        setConfigured(false);
      } else {
        setError(err?.response?.data?.error || 'Could not start verification. Try again.');
      }
      setLoading(false);
    }
  }, []);

  // Auto-start once when Veriff is configured (post-signup path).
  useEffect(() => {
    if (configured === true && !autoStarted.current) {
      autoStarted.current = true;
      void launchSession();
    }
  }, [configured, launchSession]);
  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.register}>
      <PublicAuthHero
        title="Confirm"
        accent="it’s you"
        copy="Scan a government ID and take a live selfie. Your Identity checked badge appears only after approval."
      />

      <div className={`${publicPanelClass} mt-6 space-y-4 p-5`}>
        <ol className={`${publicMutedCopyClass} list-decimal space-y-2 pl-5 text-sm`}>
          <li>Photograph your passport or driving licence</li>
          <li>Take a live selfie</li>
          <li>We show your copper checkmark when Veriff approves</li>
        </ol>

        {error ? <p className={publicErrorClass}>{error}</p> : null}

        {configured === false ? (
          <div className="space-y-3">
            <p className={publicMutedCopyClass}>
              Veriff keys are not set on the API. Use the manual capture flow or continue to profile setup.
            </p>
            <Link to="/verify/id/manual" className={publicPrimaryButtonClass}>
              Manual ID check
            </Link>
            {!FEATURES.requireIdVerification ? (
              <Link to="/profile/setup" className={publicSecondaryButtonClass}>
                Continue without verifying
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void launchSession()}
              className={publicPrimaryButtonClass}
            >
              {loading ? 'Opening secure check…' : 'Start ID + selfie check'}
            </button>
            {!FEATURES.requireIdVerification ? (
              <Link to="/profile/setup" className={publicSecondaryButtonClass}>
                Skip for now
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </PublicAuthShell>
  );
};
