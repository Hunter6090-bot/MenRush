import { FEATURES } from '../lib/featureFlags';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import {
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { PulseRing } from '../components/PulseRing';
import {
  readStoredInviteCode,
  storeInviteCode,
} from '../lib/betaInvite';
import {
  PRIDE_PROMO_CODE,
  clearStoredPridePromoCode,
  isPridePromoCode,
  readStoredPridePromoCode,
  storePridePromoCode,
} from '../lib/pridePromo';
import {
  publicErrorClass,
  publicInputClass,
  publicInviteChipClass,
  publicLabelClass,
  publicLinkClass,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';
import { launchVeriffInContext, type VeriffFrameHandle } from '../lib/veriff';

interface FormState {
  displayName: string;
  email: string;
  dob: string;
  password: string;
  ageConsent: boolean;
  idConsent: boolean;
  legalConsent: boolean;
}

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function passwordScore(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score >= 3) return 3;
  if (score === 2) return 2;
  if (score === 1) return 1;
  return 0;
}

const ADULT_POLL_MS = 2000;
const ADULT_POLL_MAX_MS = 120_000;

/**
 * Run signup 18+ age gate (document DOB via Veriff). Not the optional Verified badge.
 * Under-18 → rejection path; no account is created.
 */
async function completeAdultAssuranceGate(opts: {
  fixtureAllowed: boolean;
  frameRef: React.MutableRefObject<VeriffFrameHandle | null>;
  signal: { cancelled: boolean };
}): Promise<{ token: string } | { underage: true } | { error: string }> {
  const { data: started } = await authAPI.startAdultAssurance();
  const sessionId = started.sessionId;
  const sessionUrl = started.sessionUrl;

  // BOA90 / local fixture: apply outcome without a live Veriff document.
  // Under-18 rejection: /register?adultFixture=underage
  const fixtureParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('adultFixture')
      : null;
  if (opts.fixtureAllowed && fixtureParam) {
    const outcome =
      fixtureParam === 'underage'
        ? 'underage'
        : fixtureParam === 'declined'
          ? 'declined'
          : 'adult';
    const fix = await authAPI.adultAssuranceFixture({ sessionId, outcome });
    if (fix.data.adultStatus === 'underage' || outcome === 'underage') {
      return { underage: true };
    }
    if (fix.data.assurance_token) return { token: fix.data.assurance_token };
    const polled = await authAPI.adultAssuranceStatus(sessionId);
    if (polled.data.underage || polled.data.status === 'underage') return { underage: true };
    if (polled.data.assurance_token) return { token: polled.data.assurance_token };
    return { error: 'Age check did not finish. Please try again.' };
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    opts.frameRef.current = launchVeriffInContext(sessionUrl, {
      onSubmitted: () => {
        if (settled) return;
        settled = true;
        opts.frameRef.current?.close();
        opts.frameRef.current = null;
        void authAPI.markAdultAssuranceSubmitted(sessionId).catch(() => undefined);
        resolve();
      },
      onCanceled: () => {
        if (settled) return;
        settled = true;
        opts.frameRef.current = null;
        reject(new Error('Age check cancelled.'));
      },
    });
  });

  const startedAt = Date.now();
  while (!opts.signal.cancelled && Date.now() - startedAt < ADULT_POLL_MAX_MS) {
    const { data } = await authAPI.adultAssuranceStatus(sessionId);
    if (data.underage || data.status === 'underage') return { underage: true };
    if (data.status === 'passed' && data.assurance_token) {
      return { token: data.assurance_token };
    }
    if (
      data.status === 'declined' ||
      data.status === 'expired' ||
      data.status === 'abandoned' ||
      data.status === 'failed'
    ) {
      return {
        error:
          'Age check did not pass. MenRush is 18+ only. This is not the optional Verified badge — try again with your own document.',
      };
    }
    await new Promise((r) => setTimeout(r, ADULT_POLL_MS));
  }
  return { error: 'Age check timed out. Please try again.' };
}

export const Register = () => {
  const [searchParams] = useSearchParams();
  const inviteFromQuery = searchParams.get('invite')?.trim() || '';
  const promoFromQuery = searchParams.get('promo')?.trim() || '';
  const [inviteCode] = useState(() => inviteFromQuery || readStoredInviteCode() || '');
  const [promoCode, setPromoCode] = useState(() => {
    const fromQuery = promoFromQuery;
    const fromStore = readStoredPridePromoCode();
    if (fromQuery) return fromQuery.trim().toUpperCase().replace(/\s+/g, ' ');
    return fromStore || '';
  });
  const referralFromQuery = searchParams.get('ref')?.trim() || '';
  const [referralCode, setReferralCode] = useState(() => referralFromQuery.toUpperCase());
  const [form, setForm] = useState<FormState>({
    displayName: '',
    email: '',
    dob: '',
    password: '',
    ageConsent: false,
    idConsent: false,
    legalConsent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [assurancePhase, setAssurancePhase] = useState<'idle' | 'checking'>('idle');
  const [adultRequired, setAdultRequired] = useState(false);
  const [fixtureAllowed, setFixtureAllowed] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const frameRef = useRef<VeriffFrameHandle | null>(null);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    if (inviteFromQuery) {
      storeInviteCode(inviteFromQuery);
    }
  }, [inviteFromQuery]);

  useEffect(() => {
    let alive = true;
    void authAPI
      .adultAssuranceRequired()
      .then((res) => {
        if (!alive) return;
        setAdultRequired(Boolean(res.data.required));
        setFixtureAllowed(Boolean(res.data.fixtureAllowed));
      })
      .catch(() => {
        if (!alive) return;
        setAdultRequired(false);
        setFixtureAllowed(false);
      });
    return () => {
      alive = false;
      cancelRef.current.cancelled = true;
      frameRef.current?.close();
      frameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!promoFromQuery) return;
    if (isPridePromoCode(promoFromQuery)) {
      const display = promoFromQuery.trim().toUpperCase().replace(/\s+/g, ' ');
      setPromoCode(display || PRIDE_PROMO_CODE);
      storePridePromoCode(PRIDE_PROMO_CODE);
      return;
    }
    setPromoCode(promoFromQuery.trim().toUpperCase());
    clearStoredPridePromoCode();
  }, [promoFromQuery]);

  if (token) {
    return <Navigate to="/app" replace />;
  }

  const onPromoChange = (value: string) => {
    setError('');
    setPromoCode(value);
  };

  const clearPromo = () => {
    setError('');
    setPromoCode('');
    clearStoredPridePromoCode();
  };

  const setField = <K extends keyof FormState>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError('');
      setForm((prev) => ({
        ...prev,
        [field]:
          (e.target as HTMLInputElement).type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : e.target.value,
      }) as FormState);
    };

  const helperClass = 'text-[13px] leading-[1.55] text-[var(--cream-muted)]';

  const age = useMemo(() => calcAge(form.dob), [form.dob]);
  const pwScore = useMemo(() => passwordScore(form.password), [form.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[A-Za-z0-9_-]{2,24}$/.test(form.displayName)) {
      setError('Display name must be 2–24 chars: letters, numbers, _ or -.');
      return;
    }
    if (age == null || age < 18) {
      setError('You must be 18 or older to sign up.');
      return;
    }
    if (form.password.length < 12 || pwScore < 2) {
      setError('Password must be at least 12 chars with mixed case and a number.');
      return;
    }
    if (!form.ageConsent || !form.legalConsent) {
      setError('Please confirm all consent checkboxes.');
      return;
    }
    if (FEATURES.requireIdVerification && !form.idConsent) {
      setError('Please confirm the ID verification consent.');
      return;
    }

    setLoading(true);
    cancelRef.current.cancelled = false;
    try {
      let adultToken: string | undefined;
      if (adultRequired) {
        setAssurancePhase('checking');
        const gate = await completeAdultAssuranceGate({
          fixtureAllowed,
          frameRef,
          signal: cancelRef.current,
        });
        setAssurancePhase('idle');
        if ('underage' in gate) {
          navigate('/register/underage', { replace: true });
          return;
        }
        if ('error' in gate) {
          setError(gate.error);
          return;
        }
        adultToken = gate.token;
      }

      const trimmedPromo = promoCode.trim();
      const trimmedReferral = referralCode.trim();
      if (trimmedPromo) {
        clearStoredPridePromoCode();
      }
      const res = await authAPI.register({
        name: form.displayName,
        email: form.email,
        age: age ?? 0,
        date_of_birth: form.dob,
        password: form.password,
        ...(inviteCode ? { invite_code: inviteCode } : {}),
        ...(trimmedPromo ? { promo_code: trimmedPromo } : {}),
        ...(trimmedReferral ? { referral_code: trimmedReferral } : {}),
        ...(adultToken ? { adult_assurance_token: adultToken } : {}),
      });
      if (res.data.requiresEmailConfirm) {
        const confirmEmail =
          typeof res.data.email === 'string' ? res.data.email : form.email.trim().toLowerCase();
        navigate(`/check-email?email=${encodeURIComponent(confirmEmail)}`, { replace: true });
        return;
      }
      if (res.data.token && res.data.user) {
        setAuth(res.data.user, res.data.token, (res.data as any).refresh_token);
        navigate('/profile/setup', { replace: true });
        return;
      }
      navigate(
        `/check-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`,
        { replace: true },
      );
    } catch (err: any) {
      const msg = err?.message || err.response?.data?.error || 'Registration failed. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Registration failed. Please try again.');
    } finally {
      setAssurancePhase('idle');
      setLoading(false);
    }
  };

  const segColor = (idx: number): string => {
    if (pwScore <= idx) return '#3D2B0E';
    if (pwScore === 1) return '#A45E18';
    if (pwScore === 2) return '#C4832A';
    return '#D4943B';
  };

  const submitLabel =
    assurancePhase === 'checking'
      ? 'Checking you are 18+…'
      : loading
        ? 'Creating account…'
        : 'Create Account';

  return (
    <PublicAuthShell>
      <PublicAuthHero
        title="Create your"
        accent="account."
        copy="Pick a username and password."
      />

      <div className={`${publicPanelClass} max-h-[min(70dvh,720px)] overflow-y-auto lg:max-h-none lg:overflow-visible`}>
        {inviteCode ? (
          <div className={publicInviteChipClass}>
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#E0A14A]">
              Invite code
            </span>
            <span className="font-mono text-sm tracking-[0.12em] text-[#F0E0C0]">{inviteCode}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <label className={publicLabelClass} htmlFor="register-username">
              Username
            </label>
            <input
              id="register-username"
              type="text"
              value={form.displayName}
              onChange={setField('displayName')}
              placeholder="What men will see"
              aria-label="Display name"
              required
              minLength={2}
              maxLength={24}
              pattern="[A-Za-z0-9_-]{2,24}"
              className={publicInputClass}
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className={publicLabelClass} htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={form.email}
              onChange={setField('email')}
              placeholder="you@email.com"
              required
              className={publicInputClass}
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className={publicLabelClass} htmlFor="register-dob">
              Date of birth
            </label>
            <input
              id="register-dob"
              type="date"
              value={form.dob}
              onChange={setField('dob')}
              required
              className={publicInputClass}
            />
            <p className={helperClass}>You must be 18 or older.</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className={publicLabelClass} htmlFor="register-password">
              Password
            </label>
            <div className="flex flex-col gap-2">
              <input
                id="register-password"
                type="password"
                value={form.password}
                onChange={setField('password')}
                placeholder="At least 12 characters"
                required
                minLength={12}
                className={publicInputClass}
              />
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: segColor(i) }}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[var(--cream-muted)]">
            <input
              type="checkbox"
              checked={form.ageConsent}
              onChange={setField('ageConsent')}
              required
              className="mt-0.5 h-4 w-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
            />
            <span>I confirm I am 18 years or older.</span>
          </label>

          {FEATURES.requireIdVerification ? (
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[var(--cream-muted)]">
              <input
                type="checkbox"
                checked={form.idConsent}
                onChange={setField('idConsent')}
                required
                className="mt-0.5 h-4 w-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
              />
              <span>
                I understand MenRush requires a government-issued photo ID plus a live selfie that
                matches that ID before I can use the app.
              </span>
            </label>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[var(--cream-muted)]">
            <input
              type="checkbox"
              checked={form.legalConsent}
              onChange={setField('legalConsent')}
              required
              className="mt-0.5 h-4 w-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
            />
            <span>
              I have read and accept the{' '}
              <Link to="/terms" className={`${publicLinkClass} underline-offset-2 hover:underline`}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className={`${publicLinkClass} underline-offset-2 hover:underline`}>
                Privacy Policy
              </Link>
              , including sharing your location for Nearby discovery.
            </span>
          </label>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <label className={publicLabelClass} htmlFor="register-promo-code">
                Pride promo (optional)
              </label>
              {promoCode ? (
                <button
                  type="button"
                  onClick={clearPromo}
                  className="text-[12px] font-bold text-[#E0A14A] hover:text-[#C4832A]"
                  data-testid="register-promo-clear"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <input
              id="register-promo-code"
              type="text"
              value={promoCode}
              onChange={(e) => onPromoChange(e.target.value)}
              placeholder="If you have one"
              aria-label="Pride promo code"
              autoComplete="off"
              spellCheck={false}
              className={`${publicInputClass} font-mono tracking-[0.08em]`}
              data-testid="register-promo-input"
            />
            <p className={helperClass} data-testid="register-pride-note">
              Optional Pride promo if you have one.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className={publicLabelClass} htmlFor="register-referral-code">
              Referral code (optional)
            </label>
            <input
              id="register-referral-code"
              type="text"
              value={referralCode}
              onChange={(e) => {
                setError('');
                setReferralCode(e.target.value.toUpperCase());
              }}
              placeholder="If a friend shared one"
              aria-label="Referral code"
              autoComplete="off"
              spellCheck={false}
              className={`${publicInputClass} font-mono tracking-[0.08em]`}
              data-testid="register-referral-input"
            />
            <p className={helperClass} data-testid="register-referral-note">
              Optional. Not required to sign up.
            </p>
          </div>

          {adultRequired ? (
            <p className={helperClass} data-testid="register-adult-assurance-note">
              Before your account is created, we run an 18+ age check from your document date of
              birth. That is not the optional Verified badge on Profile.
            </p>
          ) : null}

          {error ? <p className={publicErrorClass}>{error}</p> : null}

          <p className={helperClass} data-testid="register-gift-note">
            Sign up before 1 October 2026 and you get 30 days of Premium free. A Pride promo
            replaces that gift and does not stack.
          </p>

          <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
            {loading ? (
              <>
                <PulseRing size={16} /> {submitLabel}
              </>
            ) : (
              submitLabel
            )}
          </button>

          <p className="m-0 text-center text-[15px] text-[var(--cream-muted)]">
            Already have an account?{' '}
            <Link to="/login" className={publicLinkClass}>
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </PublicAuthShell>
  );
};
