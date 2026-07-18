import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAPI } from '../api/verify';
import { trackEventOnce } from '../observability/analytics';
import { VerifySignOut } from '../components/VerifySignOut';
import { consumePostAuthRedirect } from '../lib/profileLinks';
import { FEATURES } from '../lib/featureFlags';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import {
  publicMutedCopyClass,
  publicPanelClass,
  publicPrimaryButtonClass,
  publicSecondaryButtonClass,
} from '../lib/publicStyles';

const REASON_COPY: Record<string, string> = {
  document_unverified_other: "We couldn't read your ID clearly. Try again with better lighting.",
  document_expired: 'That ID is expired. Try a valid government ID.',
  document_type_not_supported: "That document type isn't supported. Try a passport or driving license.",
  selfie_face_mismatch: "The selfie didn't match the photo on your ID. Try again face-on.",
  selfie_unverified_other: "We couldn't verify your selfie. Make sure your face is well-lit and in frame.",
  consent_declined: 'Verification needs your consent to proceed.',
  under_supported_age: 'Verification could not confirm you are 18+.',
};

export const VerifyRejected: React.FC = () => {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    trackEventOnce('verification_transition', { state: 'rejected_viewed' }, 'verification_rejected_viewed');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await verifyAPI.status();
        if (cancelled) return;
        setReason(res.data.rejection_reason);
      } catch {
        // ignore — surface generic copy
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const friendly = reason?.includes('already linked')
    ? 'This government ID is already linked to another MenRush account. One ID, one account — no exceptions.'
    : (reason && REASON_COPY[reason]) ||
      "We couldn't verify your ID. The image may have been blurry or didn't match your selfie.";

  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.verify} homeTo="/discover">
      <PublicAuthHero
        title="We couldn't verify"
        accent="your ID."
        copy={friendly}
      />

      <div className={publicPanelClass}>
        {reason ? (
          <p className="m-0 text-center font-mono text-[11px] text-[var(--cream-muted)]/70">code: {reason}</p>
        ) : null}

        {!FEATURES.requireIdVerification ? (
          <>
            <p className={`${publicMutedCopyClass} text-center`}>
              ID verification is paused for beta. You can use the app now — we&apos;ll ask again at
              grand opening once the scanner is fixed.
            </p>
            <button
              type="button"
              onClick={() => navigate(consumePostAuthRedirect('/profile/setup'))}
              className={publicPrimaryButtonClass}
            >
              Continue to the app
            </button>
            <button type="button" onClick={() => navigate('/verify')} className={publicSecondaryButtonClass}>
              Try verification again
            </button>
          </>
        ) : (
          <button type="button" onClick={() => navigate('/verify')} className={publicPrimaryButtonClass}>
            Try again
          </button>
        )}

        <VerifySignOut />
      </div>
    </PublicAuthShell>
  );
};

export default VerifyRejected;
