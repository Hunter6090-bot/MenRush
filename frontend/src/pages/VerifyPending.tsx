import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAPI } from '../api/verify';
import { useAuthStore } from '../hooks/store';
import { PulseRing } from '../components/PulseRing';
import { consumePostAuthRedirect } from '../lib/profileLinks';
import { trackEventOnce } from '../observability/analytics';
import { VerifySignOut } from '../components/VerifySignOut';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import {
  publicInfoBoxClass,
  publicMutedCopyClass,
  publicPanelClass,
} from '../lib/publicStyles';

export const VerifyPending: React.FC = () => {
  const navigate = useNavigate();
  const setVerified = useAuthStore((s) => s.setVerified);
  const [tick, setTick] = useState(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const res = await verifyAPI.status();
        if (cancelled) return;
        const { status, is_verified } = res.data;
        if (is_verified || status === 'verified') {
          trackEventOnce('verification_transition', { state: 'verified' }, 'verification_verified');
          stoppedRef.current = true;
          setVerified('verified', true);
          navigate(consumePostAuthRedirect('/discover'));
          return;
        }
        if (status === 'rejected') {
          trackEventOnce('verification_transition', { state: 'rejected' }, 'verification_rejected');
          stoppedRef.current = true;
          setVerified('rejected', false);
          navigate('/verify/rejected');
          return;
        }
        if (status === 'unverified') {
          trackEventOnce('verification_transition', { state: 'reset' }, 'verification_reset');
          stoppedRef.current = true;
          setVerified('unverified', false);
          navigate('/verify');
          return;
        }
      } catch {
        // ignore transient errors
      }
    };
    poll();
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      poll();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [navigate, setVerified]);

  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.verify} homeTo="/discover">
      <PublicAuthHero
        title="Hang"
        accent="tight."
        copy="We're checking your documents. Usually under 2 minutes — sometimes a few hours during off-peak. You can leave this screen and come back."
      />

      <div className={publicPanelClass}>
        <div className="flex justify-center py-2">
          <PulseRing size={48} />
        </div>

        <div className={publicInfoBoxClass}>
          <VerifyStep label="Capture ID" done />
          <VerifyStep label="Take selfie" done />
          <VerifyStep label="Review documents" pending />
          <VerifyStep label="Issue badge" />
        </div>

        <p className={publicMutedCopyClass}>
          We'll update your profile the moment review finishes. Last checked {tick * 5}s ago.
        </p>

        <VerifySignOut />
      </div>
    </PublicAuthShell>
  );
};

function VerifyStep({
  label,
  done,
  pending,
}: {
  label: string;
  done?: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done
            ? 'bg-[#C4832A] text-[#1A0E03]'
            : pending
              ? 'border-2 border-[#C4832A] bg-transparent'
              : 'border border-[rgba(240,224,192,0.2)] bg-[rgba(13,10,6,0.35)]'
        }`}
      >
        {done ? '✓' : null}
      </span>
      <span
        className={`text-[13.5px] ${
          done ? 'font-semibold text-[#F0E0C0]' : pending ? 'font-semibold text-[#E0A14A]' : 'text-[#A89070]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default VerifyPending;
