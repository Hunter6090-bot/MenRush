import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { premiumAPI, PremiumPlan } from '../api/premium';
import { useAuthStore } from '../hooks/store';
import { BETA_INVITE_REQUIRED } from '../lib/betaInvite';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { MobileBackButton } from '../components/MobileBackButton';
import { ThemeToggle } from '../components/ThemeToggle';
const FEATURES = [
  'See who already matched you',
  'See everyone who viewed your profile',
  'Boost to the top of nearby',
  'Unlimited matches — no daily cap',
  'Ghost browse invisibly',
  'Full photo gallery',
  'Expanded discovery radius',
  'Read receipts and rich media',
];

export const Premium: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setPremium = useAuthStore((s) => s.setPremium);

  const [plan, setPlan] = useState<PremiumPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(Boolean(user?.is_premium));

  useEffect(() => {
    Promise.all([premiumAPI.getPlans(), premiumAPI.getStatus()])
      .then(([plansRes, statusRes]) => {
        setPlan(plansRes.data.plans[0] ?? null);
        setIsPremium(statusRes.data.is_premium);
        setPremium(statusRes.data.tier, statusRes.data.is_premium);
      })
      .catch(() => setError('Could not load premium plans.'))
      .finally(() => setLoading(false));
  }, [setPremium]);

  const handleUpgrade = async () => {
    setError(null);
    setCheckingOut(true);
    try {
      const returnUrl = `${window.location.origin}/premium?status=return`;
      const res = await premiumAPI.subscribe('premium', returnUrl);
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'ccbill_not_configured') {
        setError('Billing is not configured yet. CCBill credentials are pending merchant approval.');
      } else {
        setError('Could not start checkout. Try again in a moment.');
      }
      setCheckingOut(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/75" />

      <div className="fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between sm:absolute sm:left-3 sm:right-3">
        <MobileBackButton fallback="/profile" onClick={() => navigate('/profile')} />
        <ThemeToggle variant="header" />
      </div>

      <div className="relative z-10 w-full max-w-lg animate-slide-up">
        <div className="bg-[#1E1508]/90 backdrop-blur-xl border border-[#3D2B0E] rounded-2xl p-7 shadow-card text-[#F0E0C0]">
          <div className="flex justify-center mb-4">
            <PulseRing size={40} label="Premium" />
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight mb-1 text-[#F0E0C0]">
            MenRush Premium
          </h1>
          <p className="text-sm text-[var(--cream-muted)] text-center mb-6">
            {BETA_INVITE_REQUIRED
              ? 'Premium perks are included free during the private beta.'
              : 'No swiping theatre. Pay once. Get the edge.'}
          </p>

          {BETA_INVITE_REQUIRED ? (
            <div className="rounded-xl border border-[#C4832A]/40 bg-[#C4832A]/10 p-4 text-center mb-5">
              <p className="text-[#C4832A] font-bold">Beta access includes Premium</p>
              <p className="text-xs text-[var(--cream-muted)] mt-1">
                Billing stays off until CCBill merchant approval. Enjoy the full feature set while we test.
              </p>
            </div>
          ) : null}

          {isPremium ? (
            <div className="rounded-xl border border-[#C4832A]/40 bg-[#C4832A]/10 p-4 text-center mb-5">
              <p className="text-[#C4832A] font-bold">You&apos;re Premium.</p>
              <p className="text-xs text-[var(--cream-muted)] mt-1">Your perks are active.</p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-10">
              <PulseRing size={28} />
            </div>
          ) : (
            <>
              <ul className="space-y-2 mb-6 text-sm text-[#D4C4A8]">
                {FEATURES.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[#C4832A]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan && !BETA_INVITE_REQUIRED ? (
                <button
                  type="button"
                  disabled={checkingOut || isPremium}
                  onClick={handleUpgrade}
                  className="w-full rounded-xl border border-[#C4832A]/50 bg-[#C4832A]/15 hover:bg-[#C4832A]/25 transition-colors p-4 disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                      <p className="font-bold text-[#F0E0C0]">{plan.name}</p>
                      <p className="text-xs text-[var(--cream-muted)] mt-1">{plan.tagline}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-[#C4832A]">£{plan.price}</p>
                      <p className="text-[10px] text-[var(--cream-muted)]">/ {plan.period_days} days</p>
                    </div>
                  </div>
                  {checkingOut ? (
                    <p className="text-xs text-[#C4832A] mt-2 flex items-center gap-2">
                      <PulseRing size={12} /> Redirecting to secure checkout…
                    </p>
                  ) : null}
                </button>
              ) : null}
            </>
          )}

          {error ? (
            <p className="text-sm text-red-400 text-center mt-4">{error}</p>
          ) : null}

          <p className="text-[10px] text-[#7A6A50] text-center mt-5 leading-relaxed">
            Billing via CCBill — dating-friendly processor. Card details never touch MenRush servers.
          </p>

          <button
            type="button"
            onClick={() => navigate(isPremium ? '/discover' : '/profile')}
            className="w-full mt-4 text-sm text-[var(--cream-muted)] hover:text-[#C4832A] transition-colors"
          >
            {isPremium ? 'Back to Discover' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  );
};