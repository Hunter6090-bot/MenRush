import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { verifyAPI } from '../api/verify';
import { useAuthStore } from '../hooks/store';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';

let _stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise(): Promise<Stripe | null> {
  if (_stripePromise) return _stripePromise;
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key || key === 'pk_test___SET_ME__') {
    _stripePromise = Promise.resolve(null);
  } else {
    _stripePromise = loadStripe(key);
  }
  return _stripePromise;
}

export const Verify: React.FC = () => {
  const navigate = useNavigate();
  const setVerified = useAuthStore((s) => s.setVerified);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await verifyAPI.start();
      const clientSecret = res.data.client_secret;

      const stripe = await getStripePromise();
      if (!stripe) {
        setError(
          'Identity verification is not yet configured for this environment. Set VITE_STRIPE_PUBLISHABLE_KEY in frontend/.env to enable.',
        );
        setLoading(false);
        return;
      }

      // Stripe types may not yet include verifyIdentity — cast through unknown.
      const verifyIdentity = (stripe as unknown as {
        verifyIdentity: (cs: string) => Promise<{ error?: { message?: string } }>;
      }).verifyIdentity;

      const result = await verifyIdentity(clientSecret);
      if (result.error) {
        setError(result.error.message ?? 'Verification was cancelled.');
        setLoading(false);
        return;
      }

      setVerified('pending', false);
      navigate('/verify/pending');
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'stripe_not_configured') {
        setError(
          'Identity verification is not yet configured on the server. STRIPE_SECRET_KEY is missing.',
        );
      } else if (code === 'already_verified') {
        setVerified('verified', true);
        navigate('/discover');
      } else {
        setError(err?.response?.data?.error || 'Could not start verification.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden flex items-center justify-center p-4">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="bg-[#1E1508]/85 backdrop-blur-xl border border-[#3D2B0E] rounded-2xl p-7 shadow-card text-[#F0E0C0]">
          <div className="flex justify-center mb-5">
            <ShieldIcon className="w-14 h-14 text-[#C4832A]" />
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight mb-2">
            Verify your identity
          </h1>
          <p className="text-sm text-[#A89070] text-center leading-relaxed mb-6">
            MenRush is 100% government-ID verified. To access nearby men,
            matches, and chat, confirm a photo ID and a quick selfie. Takes
            under 2 minutes.
          </p>

          <ul className="space-y-2.5 mb-6 text-xs text-[#F0E0C0]/85">
            <Bullet>Driving license, passport, or national ID card</Bullet>
            <Bullet>Front + back photo + a real-time selfie</Bullet>
            <Bullet>Encrypted by Stripe Identity. We never see your ID image.</Bullet>
            <Bullet>One-time check. Verified badge stays on your profile.</Bullet>
          </ul>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-[#8B4513]/15 border border-[#8B4513]/30 text-xs text-[#F0E0C0]/90">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <PulseRing size={16} /> Opening Stripe Identity…
              </>
            ) : (
              'Start verification'
            )}
          </button>

          <p className="text-[11px] text-[#A89070]/70 text-center mt-4 leading-snug">
            By continuing you agree to share your ID and selfie with Stripe
            Identity for the sole purpose of confirming you are a real adult.
          </p>
        </div>
      </div>
    </div>
  );
};

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2">
    <span className="text-[#C4832A] mt-0.5">•</span>
    <span>{children}</span>
  </li>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path
      d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z"
      strokeLinejoin="round"
    />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Verify;
