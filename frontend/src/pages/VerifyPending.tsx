import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAPI } from '../api/verify';
import { useAuthStore } from '../hooks/store';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { trackEventOnce } from '../observability/analytics';

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
          navigate('/discover');
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
    <div className="relative min-h-dvh overflow-hidden flex items-center justify-center p-4">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="bg-[#1E1508]/85 backdrop-blur-xl border border-[#3D2B0E] rounded-2xl p-7 shadow-card text-[#F0E0C0] text-center">
          <div className="flex justify-center mb-5">
            <PulseRing size={48} />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">
            Reviewing your ID
          </h1>
          <p className="text-sm text-[#A89070] leading-relaxed mb-5">
            Stripe is checking your document and selfie. This usually takes
            under a minute. You can leave this screen — we will notify you
            when it is done.
          </p>
          <div className="text-[11px] text-[#A89070]/70">
            Last checked {tick * 5}s ago
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyPending;
