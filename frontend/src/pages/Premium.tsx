import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { premiumAPI, PremiumPlan, PremiumInvoice, ManualPaymentInstructions } from '../api/premium';
import { authAPI } from '../api/client';
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
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [cancellingInvoice, setCancellingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(Boolean(user?.is_premium));
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);

  // Manual invoice state
  const [unpaidInvoice, setUnpaidInvoice] = useState<PremiumInvoice | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<ManualPaymentInstructions | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Password set/change flow in the payment journey
  const [hasPassword, setHasPassword] = useState<boolean>(true);
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      premiumAPI.getPlans(),
      premiumAPI.getStatus(),
      premiumAPI.getUnpaidInvoice(),
      authAPI.getPasswordStatus().catch(() => ({ data: { has_password: true } })),
    ])
      .then(([plansRes, statusRes, unpaidRes, pwStatusRes]) => {
        setPlan(plansRes.data.plans[0] ?? null);
        setIsPremium(statusRes.data.is_premium);
        setPremiumUntil(statusRes.data.premium_until);
        setPremium(statusRes.data.tier, statusRes.data.is_premium);
        if (unpaidRes.data?.invoice) {
          setUnpaidInvoice(unpaidRes.data.invoice);
          setPaymentInstructions(unpaidRes.data.payment_instructions ?? null);
        }
        setHasPassword(pwStatusRes.data?.has_password ?? true);
      })
      .catch(() => setError('Could not load premium options.'))
      .finally(() => setLoading(false));
  }, [setPremium]);

  const handleCreateInvoice = async () => {
    setError(null);
    setGeneratingInvoice(true);
    try {
      const res = await premiumAPI.createInvoice({
        plan_tier: 'premium',
        plan_days: 30,
        amount_pence: 699,
      });
      setUnpaidInvoice(res.data.invoice);
      setPaymentInstructions(res.data.payment_instructions);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not create invoice. Please try again.';
      setError(msg);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!unpaidInvoice) return;
    setCancellingInvoice(true);
    setError(null);
    try {
      await premiumAPI.cancelInvoice(unpaidInvoice.id);
      setUnpaidInvoice(null);
      setPaymentInstructions(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not cancel invoice.');
    } finally {
      setCancellingInvoice(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (hasPassword && !currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (hasPassword && currentPassword === newPassword) {
      setPwError('New password must be different from current password.');
      return;
    }

    setPwBusy(true);
    try {
      await authAPI.setPassword({
        current_password: hasPassword ? currentPassword : undefined,
        new_password: newPassword,
      });
      setHasPassword(true);
      setPwSuccess('Password saved successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordStep(false), 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not update password.';
      setPwError(msg);
    } finally {
      setPwBusy(false);
    }
  };

  const untilDateFormatted = premiumUntil
    ? new Date(premiumUntil).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="relative min-h-dvh overflow-hidden flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/75" />

      <div className="fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between sm:absolute sm:left-3 sm:right-3">
        <MobileBackButton fallback="/profile" onClick={() => navigate('/profile')} />
        <ThemeToggle variant="header" />
      </div>

      <div className="relative z-10 w-full max-w-lg animate-slide-up my-8">
        <div className="bg-[var(--bg-card)]/90 backdrop-blur-xl border border-[var(--border-default)] rounded-2xl p-6 sm:p-7 shadow-card text-[var(--cream)]">
          <div className="flex justify-center mb-3">
            <PulseRing size={40} label="Premium" />
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight mb-1 text-[var(--cream)]">
            MenRush Premium
          </h1>
          <p className="text-sm text-[var(--cream-muted)] text-center mb-5">
            {BETA_INVITE_REQUIRED
              ? 'Premium perks are included free during the private beta.'
              : 'Direct nearby discovery. Real perks. No subscription traps.'}
          </p>

          <div className="rounded-xl border border-[#C4832A]/40 bg-[#C4832A]/10 p-4 text-center mb-5">
            <p className="text-[#C4832A] font-bold">
              {BETA_INVITE_REQUIRED ? 'Beta access includes Premium' : 'In-app card billing is under merchant review'}
            </p>
            <p className="text-xs text-[var(--cream-muted)] mt-1">
              We are not taking card payments in-app yet while Verotel processor review is pending.
              Use the manual bank invoice below for early activation, or contact{' '}
              <a href="mailto:support@menrush.com" className="text-[#C4832A] underline hover:text-[#E0A040]">
                support@menrush.com
              </a>.
            </p>
          </div>

          {isPremium ? (
            <div className="rounded-xl border border-[#C4832A]/40 bg-[#C4832A]/10 p-4 text-center mb-5" data-testid="premium-active-status">
              <p className="text-[#C4832A] font-bold">You&apos;re Premium.</p>
              <p className="text-xs text-[var(--cream-muted)] mt-1">
                {untilDateFormatted
                  ? `Active until ${untilDateFormatted}. Entitlements stack on extension.`
                  : 'Your perks are active.'}
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-10">
              <PulseRing size={28} />
            </div>
          ) : (
            <>
              {/* Features List */}
              <ul className="space-y-2 mb-6 text-sm text-[#D4C4A8]">
                {FEATURES.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[#C4832A]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* Unpaid Invoice Card & Payment Instructions */}
              {unpaidInvoice && paymentInstructions ? (
                <div className="rounded-xl border border-[#C4832A]/60 bg-[#16120C] p-5 mb-5 space-y-4 shadow-lg" data-testid="unpaid-invoice-card">
                  <div className="flex items-start justify-between border-b border-[#3D2C1D] pb-3">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#C4832A]/20 text-[#C4832A] border border-[#C4832A]/30">
                        Invoice Unpaid
                      </span>
                      <p className="font-mono text-sm font-semibold text-[var(--cream)] mt-1">
                        {unpaidInvoice.invoice_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-[#C4832A]">
                        £{(unpaidInvoice.amount_pence / 100).toFixed(2)}
                      </p>
                      <p className="text-[11px] text-[var(--cream-muted)]">
                        {unpaidInvoice.plan_days} days
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[var(--cream)] mb-2">
                      Bank Transfer Instructions:
                    </p>
                    {paymentInstructions.bank_configured && paymentInstructions.sort_code && paymentInstructions.account_number ? (
                      <div className="space-y-2 text-xs font-mono bg-[#0D0A06] p-3 rounded-lg border border-[#2D2014]">
                        {paymentInstructions.account_name ? (
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--cream-muted)]">Account Name:</span>
                            <span className="font-bold text-[var(--cream)]">{paymentInstructions.account_name}</span>
                          </div>
                        ) : null}
                        {paymentInstructions.bank_name ? (
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--cream-muted)]">Bank:</span>
                            <span className="font-bold text-[var(--cream)]">{paymentInstructions.bank_name}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between items-center">
                          <span className="text-[var(--cream-muted)]">Sort Code:</span>
                          <span className="font-bold text-[var(--cream)]">{paymentInstructions.sort_code}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[var(--cream-muted)]">Account No:</span>
                          <span className="font-bold text-[var(--cream)]">{paymentInstructions.account_number}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-[#2D2014]">
                          <span className="text-[#C4832A] font-semibold">Payment Ref:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#E0A14A] bg-[#C4832A]/10 px-1.5 py-0.5 rounded">
                              {paymentInstructions.payment_reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(paymentInstructions.payment_reference, 'ref')}
                              className="text-[10px] text-[var(--cream-muted)] hover:text-[#C4832A] underline"
                            >
                              {copiedField === 'ref' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-[#0D0A06] rounded-lg border border-[#2D2014] text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[#C4832A] font-semibold">Payment Ref:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#E0A14A] bg-[#C4832A]/10 px-1.5 py-0.5 rounded font-mono">
                              {paymentInstructions.payment_reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(paymentInstructions.payment_reference, 'ref')}
                              className="text-[10px] text-[var(--cream-muted)] hover:text-[#C4832A] underline"
                            >
                              {copiedField === 'ref' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <p className="text-[var(--cream-muted)] leading-relaxed">
                          Bank transfer coordinates are being provisioned by ops. Use payment reference <strong className="text-[#E0A14A] font-mono">{paymentInstructions.payment_reference}</strong> to complete payment with ops.
                        </p>
                      </div>
                    )}
                    {paymentInstructions.bank_configured && (
                      <p className="text-[11px] text-[var(--cream-muted)] mt-2 leading-relaxed">
                        Please include reference <strong className="text-[#E0A14A] font-mono">{paymentInstructions.payment_reference}</strong> on your transfer. Premium is activated once payment is confirmed by ops.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={cancellingInvoice}
                      onClick={handleCancelInvoice}
                      className="text-xs text-[var(--cream-muted)] hover:text-red-400 transition-colors"
                    >
                      {cancellingInvoice ? 'Cancelling…' : 'Cancel invoice'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Invoice Generation Button */
                plan && (
                  <button
                    type="button"
                    disabled={generatingInvoice}
                    onClick={handleCreateInvoice}
                    className="w-full rounded-xl border border-[#C4832A]/50 bg-[#C4832A]/15 hover:bg-[#C4832A]/25 transition-colors p-4 disabled:opacity-60 mb-5"
                    data-testid="generate-invoice-button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-left">
                        <p className="font-bold text-[var(--cream)]">Get MenRush Premium</p>
                        <p className="text-xs text-[var(--cream-muted)] mt-1">Manual bank invoice • 30 days access</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-[#C4832A]">£{plan.price}</p>
                        <p className="text-[10px] text-[var(--cream-muted)]">one-off</p>
                      </div>
                    </div>
                    {generatingInvoice ? (
                      <p className="text-xs text-[#C4832A] mt-2 flex items-center gap-2">
                        <PulseRing size={12} /> Generating payment invoice…
                      </p>
                    ) : null}
                  </button>
                )
              )}

              {/* Set / Change Password Step in the Journey */}
              <div className="rounded-xl border border-[var(--border-default)] bg-[#120E0A] p-4 mb-4" data-testid="premium-password-step">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--cream)]">
                      {hasPassword ? 'Login Password' : 'Set Account Password'}
                    </p>
                    <p className="text-xs text-[var(--cream-muted)]">
                      {hasPassword
                        ? 'Update your login password for direct access.'
                        : 'Set a password now for fast future sign-in.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordStep(!showPasswordStep);
                      setPwError(null);
                      setPwSuccess(null);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#C4832A]/40 text-[#C4832A] hover:bg-[#C4832A]/10 transition-colors"
                  >
                    {showPasswordStep ? 'Close' : hasPassword ? 'Change password' : 'Set password'}
                  </button>
                </div>

                {showPasswordStep && (
                  <form onSubmit={handleSavePassword} className="mt-4 space-y-3 pt-3 border-t border-[var(--border-default)]">
                    {hasPassword && (
                      <div>
                        <label className="block text-xs text-[var(--cream-muted)] mb-1">Current password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#0D0A06] border border-[#3D2C1D] rounded-lg px-3 py-2 text-sm text-[var(--cream)] placeholder-[#6A5A40] focus:border-[#C4832A] focus:outline-none"
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-[var(--cream-muted)] mb-1">New password (min 8 chars)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={8}
                        className="w-full bg-[#0D0A06] border border-[#3D2C1D] rounded-lg px-3 py-2 text-sm text-[var(--cream)] placeholder-[#6A5A40] focus:border-[#C4832A] focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--cream-muted)] mb-1">Confirm new password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={8}
                        className="w-full bg-[#0D0A06] border border-[#3D2C1D] rounded-lg px-3 py-2 text-sm text-[var(--cream)] placeholder-[#6A5A40] focus:border-[#C4832A] focus:outline-none"
                        required
                      />
                    </div>

                    {pwError && <p className="text-xs text-red-400">{pwError}</p>}
                    {pwSuccess && <p className="text-xs text-[#C4832A]">{pwSuccess}</p>}

                    <button
                      type="submit"
                      disabled={pwBusy}
                      className="w-full mt-2 py-2 px-4 rounded-lg bg-[#C4832A] hover:bg-[#A86F24] text-white font-semibold text-xs transition-colors disabled:opacity-50"
                    >
                      {pwBusy ? 'Updating…' : hasPassword ? 'Update password' : 'Save password'}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {error ? (
            <p className="text-sm text-red-400 text-center mt-3">{error}</p>
          ) : null}

          {/* Quiet face notice */}
          <p className="text-[10px] text-[#7A6A50] text-center mt-4 leading-relaxed">
            In-app card billing is under merchant review. Manual bank invoices are processed directly by MenRush upon receipt.
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
