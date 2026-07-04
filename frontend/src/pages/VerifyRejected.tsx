import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAPI } from '../api/verify';
import { RandomBackground } from '../components/RandomBackground';
import { trackEventOnce } from '../observability/analytics';
import { VerifySignOut } from '../components/VerifySignOut';

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
    <div className="relative min-h-dvh overflow-hidden flex items-center justify-center p-4">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="bg-[#1E1508]/85 backdrop-blur-xl border border-[#8B4513]/40 rounded-2xl p-7 shadow-card text-[#F0E0C0]">
          <div className="flex justify-center mb-5">
            <AlertIcon className="w-14 h-14 text-[#8B4513]" />
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight mb-2">
            We couldn't verify your ID
          </h1>
          <p className="text-sm text-[#A89070] text-center leading-relaxed mb-5">
            {friendly}
          </p>

          {reason && (
            <p className="text-[11px] font-mono text-[#A89070]/60 text-center mb-5">
              code: {reason}
            </p>
          )}

          <button
            onClick={() => navigate('/verify')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
          >
            Try again
          </button>

          <VerifySignOut />
        </div>
      </div>
    </div>
  );
};

const AlertIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="13" strokeLinecap="round" />
    <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth={2} />
  </svg>
);

export default VerifyRejected;
