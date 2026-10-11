import { invoiceStartLine, pendingStartLine, premiumStartLine } from '../lib/premiumStart';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { premiumAPI, PremiumPlan, PremiumInvoice, ManualPaymentInstructions } from '../api/premium';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { MobileBackButton } from '../components/MobileBackButton';
import { ThemeToggle } from '../components/ThemeToggle';

const IMMEDIATE_START_CONSENT_TEXT =
  'Start my Premium as soon as my payment is confirmed. I understand that if I cancel within 14 days, my refund will be reduced for the days of Premium I have had. If I leave this unticked, Premium starts after the 14 day cancellation period.';

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
  const setTokens = useAuthStore((s) => s.setTokens);

  const [plan, setPlan] = useState<PremiumPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [cancellingInvoice, setCancellingInvoice] = useState(false);
  // Terms 7.6A: unticked by default and required before an invoice is issued.
  const [immediateStartConsent, setImmediateStartConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(Boolean(user?.is_premium));
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [premiumStartsAt, setPremiumStartsAt] = useState<string | null>(null);
  // Premium included free for everyone, as the backend reports it (BETA_PREMIUM_FREE). Never hardcoded.
  const [premiumIncluded, setPremiumIncluded] = useState(false);

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
        setPremiumStartsAt(statusRes.data.premium_starts_at ?? null);
        setPremiumIncluded(Boolean(statusRes.data.beta_premium_included));
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
        immediate_start_consent: immediateStartConsent,
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
      const res = await authAPI.setPassword({
        current_password: hasPassword ? currentPassword : undefined,
        new_password: newPassword,
      });
      // The server signs out every other session and hands this one a fresh token.
      if (res.data?.token && res.data?.refresh_token) {
        setTokens(res.data.token, res.data.refresh_token);
      }
      setHasPassword(true);
      setPwSuccess(
        'Password saved. You are still signed in here. On your other devices you will need to sign in again with your new password.',
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 sm:p-7 shadow-card text-[var(--cream)]">
          <div className="flex justify-center mb-3">
            <PulseRing size={40} label="Premium" />
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight mb-1 text-[var(--cream)]">
            MenRush Premium
          </h1>
          <p className="text-[15px] text-[var(--cream-muted)] text-center mb-5">
            Direct proximity edge. Full features, no swiping theatre.
          </p>

          {!isPremium && !premiumIncluded ? (
          <div className="rounded-xl border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--nn-copper)_10%,transparent)] p-4 text-center mb-5" data-testid="premium-buy-info">
            <p className="text-[15px] font-bold text-[var(--nn-accent-text)]">In-app card billing is being set up</p>
            <p className="text-[15px] text-[var(--cream-muted)] mt-1">
              We are not taking card payments in the app yet. Use the bank invoice below to pay for
              Premium, or contact{' '}
              <a href="mailto:support@menrush.com" className="text-[var(--nn-accent-text)] underline">
                support@menrush.com
              </a>.
            </p>
          </div>
          ) : null}

          {premiumIncluded ? (
            <div className="rounded-xl border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--nn-copper)_10%,transparent)] p-4 text-center mb-5" data-testid="premium-included-free">
              <p className="text-[15px] font-bold text-[var(--nn-accent-text)]">You&apos;re Premium.</p>
              <p className="text-[15px] text-[var(--cream)] mt-1">
                Premium is included free for everyone at the moment, so there&apos;s nothing to buy.
              </p>
            </div>
          ) : isPremium ? (
            <div className="rounded-xl border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--nn-copper)_10%,transparent)] p-4 text-center mb-5" data-testid="premium-active-status">
              <p className="text-[15px] font-bold text-[var(--nn-accent-text)]">You&apos;re Premium.</p>
              <p className="text-[15px] text-[var(--cream-muted)] mt-1">
                {untilDateFormatted ? `Active until ${untilDateFormatted}.` : 'Your perks are active.'}
              </p>
            </div>
          ) : null}

          {!isPremium && !premiumIncluded && premiumStartsAt && new Date(premiumStartsAt).getTime() > Date.now() ? (
            <div
              className="rounded-xl border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--nn-copper)_10%,transparent)] p-4 text-center mb-5"
              data-testid="premium-pending-start"
            >
              <p className="text-[15px] font-bold text-[var(--cream)]">{pendingStartLine(premiumStartsAt)}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-10">
              <PulseRing size={28} />
            </div>
          ) : (
            <>
              {/* Features List */}
              <ul className="space-y-2 mb-6 text-[15px] text-[var(--cream-muted)]">
                {FEATURES.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[var(--nn-accent-text)]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* Unpaid Invoice Card & Payment Instructions */}
              {premiumIncluded ? null : unpaidInvoice && paymentInstructions ? (
                <div className="rounded-xl border border-[var(--nn-copper)] bg-[var(--bg-card)] p-5 mb-5 space-y-4 shadow-lg" data-testid="unpaid-invoice-card">
                  <div className="flex items-start justify-between border-b border-[var(--border-default)] pb-3">
                    <div>
                      <span className="text-[15px] font-bold px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--nn-copper)_15%,transparent)] text-[var(--nn-accent-text)] border border-[var(--border-default)]">
                        Invoice unpaid
                      </span>
                      <p className="font-mono text-[15px] font-semibold text-[var(--cream)] mt-1">
                        {unpaidInvoice.invoice_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-[var(--nn-accent-text)]">
                        £{(unpaidInvoice.amount_pence / 100).toFixed(2)}
                      </p>
                      <p className="text-[15px] text-[var(--cream-muted)]">
                        {unpaidInvoice.plan_days} days
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[15px] font-semibold text-[var(--cream)] mb-2">
                      Bank transfer instructions
                    </p>
                    {paymentInstructions.bank_configured && paymentInstructions.sort_code && paymentInstructions.account_number ? (
                      <div className="space-y-2 text-[15px] font-mono bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-default)]">
                        {paymentInstructions.account_name ? (
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--cream-muted)]">Account name</span>
                            <span className="font-bold text-[var(--cream)]">{paymentInstructions.account_name}</span>
                          </div>
                        ) : null}
                        {paymentInstructions.bank_name ? (
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--cream-muted)]">Bank</span>
                            <span className="font-bold text-[var(--cream)]">{paymentInstructions.bank_name}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between items-center">
                          <span className="text-[var(--cream-muted)]">Sort code</span>
                          <span className="font-bold text-[var(--cream)]">{paymentInstructions.sort_code}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[var(--cream-muted)]">Account number</span>
                          <span className="font-bold text-[var(--cream)]">{paymentInstructions.account_number}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-[var(--border-default)]">
                          <span className="text-[var(--nn-accent-text)] font-semibold">Payment reference</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--nn-accent-text)] bg-[color-mix(in_srgb,var(--nn-copper)_10%,transparent)] px-1.5 py-0.5 rounded">
                              {paymentInstructions.payment_reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(paymentInstructions.payment_reference, 'ref')}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-[15px] text-[var(--cream-muted)] hover:text-[var(--nn-accent-text)] underline"
                              data-testid="copy-reference"
                            >
                              {copiedField === 'ref' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-default)] text-[15px] space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[var(--nn-accent-text)] font-semibold">Payment reference</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--nn-accent-text)] bg-[color-mix(in_srgb,var(--nn-copper)_10%,transparent)] px-1.5 py-0.5 rounded font-mono">
                              {paymentInstructions.payment_reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(paymentInstructions.payment_reference, 'ref')}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-[15px] text-[var(--cream-muted)] hover:text-[var(--nn-accent-text)] underline"
                              data-testid="copy-reference"
                            >
                              {copiedField === 'ref' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <p className="text-[var(--cream-muted)] leading-relaxed">
                          Bank details are not shown here yet. Email support@menrush.com with your payment reference <strong className="text-[var(--nn-accent-text)] font-mono">{paymentInstructions.payment_reference}</strong> and we will reply with how to pay.
                        </p>
                      </div>
                    )}
                    {paymentInstructions.bank_configured && (
                      <p className="text-[15px] text-[var(--cream-muted)] mt-2 leading-relaxed">
                        Please include reference <strong className="text-[var(--nn-accent-text)] font-mono">{paymentInstructions.payment_reference}</strong> on your transfer.
                      </p>
                    )}
                    <p className="text-[15px] font-bold text-[var(--cream)] mt-2 leading-relaxed" data-testid="invoice-start-line">
                      {paymentInstructions.premium_start_line ?? invoiceStartLine(unpaidInvoice)}
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={cancellingInvoice}
                      onClick={handleCancelInvoice}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-[15px] text-[var(--cream-muted)] hover:text-[var(--nn-danger-text)] transition-colors"
                      data-testid="cancel-invoice"
                    >
                      {cancellingInvoice ? 'Cancelling…' : 'Cancel invoice'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Buy offer: only when there is something to buy (not Premium, not included free for everyone). */
                plan && !isPremium && !premiumIncluded && (
                  <>
                  <div
                    className="mb-3 space-y-2 text-[15px] leading-snug text-[var(--cream-muted)]"
                    data-testid="start-options"
                  >
                    <p className="font-bold text-[var(--cream)]">When your Premium starts is your choice</p>
                    <p data-testid="start-option-ticked">
                      <strong className="text-[var(--cream)]">Box ticked:</strong> Premium starts once we confirm
                      your payment. If you cancel within 14 days, your refund is reduced for the days of Premium
                      you have had.
                    </p>
                    <p data-testid="start-option-unticked">
                      <strong className="text-[var(--cream)]">Box left unticked:</strong> Premium starts after the
                      14 day cancellation period. If you cancel within the 14 days, you get a full refund.
                    </p>
                  </div>
                  <label
                    className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2 mb-2 text-[15px] leading-snug text-[var(--cream)]"
                    data-testid="immediate-start-consent-label"
                  >
                    <input
                      type="checkbox"
                      checked={immediateStartConsent}
                      onChange={(e) => setImmediateStartConsent(e.target.checked)}
                      aria-describedby="premium-start-date"
                      className="mt-0.5 h-6 w-6 shrink-0 rounded accent-[var(--nn-copper)]"
                      data-testid="immediate-start-consent"
                    />
                    <span>{IMMEDIATE_START_CONSENT_TEXT}</span>
                  </label>
                  <p
                    id="premium-start-date"
                    aria-live="polite"
                    className="mb-4 text-[15px] leading-snug font-bold text-[var(--cream)]"
                    data-testid="premium-start-date"
                  >
                    {premiumStartLine(immediateStartConsent)}
                  </p>
                  <button
                    type="button"
                    disabled={generatingInvoice}
                    aria-disabled={generatingInvoice}
                    onClick={handleCreateInvoice}
                    className="w-full rounded-xl border border-[var(--nn-copper)] bg-[color-mix(in_srgb,var(--nn-copper)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--nn-copper)_25%,transparent)] transition-colors p-4 disabled:opacity-60 mb-5"
                    data-testid="generate-invoice-button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-left">
                        <p className="font-bold text-[var(--cream)]">Get MenRush Premium</p>
                        <p className="text-[15px] text-[var(--cream-muted)] mt-1">Manual bank invoice • 30 days access</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-[var(--nn-accent-text)]">£{plan.price}</p>
                        <p className="text-[15px] text-[var(--cream-muted)]">one-off</p>
                      </div>
                    </div>
                    {generatingInvoice ? (
                      <p className="text-[15px] text-[var(--nn-accent-text)] mt-2 flex items-center gap-2">
                        <PulseRing size={12} /> Generating payment invoice…
                      </p>
                    ) : null}
                  </button>
                  </>
                )
              )}

              {/* Set / Change Password Step in the Journey */}
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 mb-4" data-testid="premium-password-step">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--cream)]">
                      {hasPassword ? 'Login Password' : 'Set Account Password'}
                    </p>
                    <p className="text-[15px] text-[var(--cream-muted)]">
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
                    className="min-h-[44px] text-[15px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--nn-copper)] text-[var(--nn-accent-text)] hover:bg-[color-mix(in_srgb,var(--nn-copper)_10%,transparent)] transition-colors"
                  >
                    {showPasswordStep ? 'Close' : hasPassword ? 'Change password' : 'Set password'}
                  </button>
                </div>

                {showPasswordStep && (
                  <form onSubmit={handleSavePassword} className="mt-4 space-y-3 pt-3 border-t border-[var(--border-default)]">
                    {hasPassword && (
                      <div>
                        <label className="block text-[15px] text-[var(--cream-muted)] mb-1">Current password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-[15px] text-[var(--cream)] placeholder-[var(--nn-faint)] focus:border-[var(--nn-copper)] focus:outline-none"
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[15px] text-[var(--cream-muted)] mb-1">New password (min 8 chars)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={8}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-[15px] text-[var(--cream)] placeholder-[var(--nn-faint)] focus:border-[var(--nn-copper)] focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] text-[var(--cream-muted)] mb-1">Confirm new password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={8}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-[15px] text-[var(--cream)] placeholder-[var(--nn-faint)] focus:border-[var(--nn-copper)] focus:outline-none"
                        required
                      />
                    </div>

                    {pwError && <p className="text-[15px] text-[var(--nn-danger-text)]">{pwError}</p>}
                    {pwSuccess && (
                      <p role="status" data-testid="password-saved" className="text-[15px] leading-snug text-[var(--nn-accent-text)]">
                        {pwSuccess}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={pwBusy}
                      className="w-full mt-2 py-2 px-4 rounded-lg bg-[var(--nn-copper)] hover:opacity-90 text-[var(--nn-on-copper)] font-semibold text-[15px] min-h-[44px] transition-colors disabled:opacity-50"
                    >
                      {pwBusy ? 'Updating…' : hasPassword ? 'Update password' : 'Save password'}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {error ? (
            <p className="text-[15px] text-[var(--nn-danger-text)] text-center mt-3">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={() => navigate(isPremium ? '/discover' : '/profile')}
            className="w-full mt-4 text-[15px] text-[var(--cream-muted)] hover:text-[var(--nn-accent-text)] transition-colors"
          >
            {isPremium ? 'Back to Discover' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  );
};
