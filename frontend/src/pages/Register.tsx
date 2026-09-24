import { FEATURES } from '../lib/featureFlags';
import React, { useMemo, useState, useEffect } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import {
  AUTH_ASSURANCE_BACKGROUND_OPACITY,
  AUTH_ASSURANCE_BRIGHTNESS,
  AUTH_ASSURANCE_GRADIENT,
  AUTH_BACKGROUND_OPACITY,
  AUTH_BACKGROUND_BRIGHTNESS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { PulseRing } from '../components/PulseRing';
import {
  AdultAssuranceFlow,
  ADULT_ASSURANCE_COPY,
} from '../components/AdultAssuranceFlow';
import { registerErrorMessage } from '../lib/authErrors';
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
  publicSelectClass,
} from '../lib/publicStyles';
import {
  UK_DOB_MONTHS,
  ageFromDateOfBirth,
  composeIsoDateOfBirth,
  daysInCalendarMonth,
  dobYearOptions,
  formatUkDobInput,
  parseUkDateOfBirth,
} from '../lib/age';

interface FormState {
  displayName: string;
  email: string;
  /** UK-order Day / Month / Year select values (empty string = unset). */
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  /** Typed UK `dd/mm/yyyy` path (accepts `/` `-` `.`). */
  dobText: string;
  password: string;
  ageConsent: boolean;
  idConsent: boolean;
  legalConsent: boolean;
}

/** Compact cream select for three-up DOB row (mobile taps). */
const dobSelectClass = `${publicSelectClass} px-3 sm:px-4`;

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
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    dobText: '',
    password: '',
    ageConsent: false,
    idConsent: false,
    legalConsent: false,
  });
  /** Selects = easy mobile path; text = dash/slash/digit entry. */
  const [dobMode, setDobMode] = useState<'select' | 'text'>('select');
  const yearOptions = useMemo(() => dobYearOptions(), []);
  const [error, setError] = useState('');
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [adultAvailable, setAdultAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAssurance, setShowAssurance] = useState(false);
  const [assurancePhase, setAssurancePhase] = useState<
    'intro' | 'liveness' | 'liveness_ok' | 'upsell' | 'id' | 'id_ok' | 'done'
  >('intro');
  const adultRequired = true;
  const [fixtureAllowed, setFixtureAllowed] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const clearError = () => {
    setError('');
    setIsDuplicateEmail(false);
  };

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
        setAdultAvailable(res.data.required === true && res.data.available === true);
        setFixtureAllowed(Boolean(res.data.fixtureAllowed));
      })
      .catch(() => {
        if (!alive) return;
        setAdultAvailable(false);
        setFixtureAllowed(false);
      });
    return () => {
      alive = false;
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
    clearError();
    setPromoCode(value);
  };

  const clearPromo = () => {
    clearError();
    setPromoCode('');
    clearStoredPridePromoCode();
  };

  const setField = <K extends keyof FormState>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      clearError();
      setForm((prev) => ({
        ...prev,
        [field]:
          (e.target as HTMLInputElement).type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : e.target.value,
      }) as FormState);
    };

  const onDobPartChange =
    (part: 'dobDay' | 'dobMonth' | 'dobYear') =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      clearError();
      const value = e.target.value;
      setForm((prev) => {
        const next = { ...prev, [part]: value };
        // Clamp day if month/year makes current day invalid (e.g. 31 → Feb).
        if (part === 'dobMonth' || part === 'dobYear') {
          const month = Number(part === 'dobMonth' ? value : next.dobMonth);
          const year = Number(part === 'dobYear' ? value : next.dobYear);
          const day = Number(next.dobDay);
          if (next.dobDay && Number.isInteger(month) && month >= 1) {
            const maxDay = daysInCalendarMonth(
              month,
              Number.isInteger(year) && year >= 1900 ? year : undefined,
            );
            if (Number.isInteger(day) && day > maxDay) {
              next.dobDay = '';
            }
          }
        }
        return next;
      });
    };

  const onDobTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setForm((prev) => ({ ...prev, dobText: formatUkDobInput(e.target.value) }));
  };

  const switchDobMode = (next: 'select' | 'text') => {
    clearError();
    setDobMode(next);
  };

  const helperClass = 'text-[13px] leading-[1.55] text-[var(--cream-muted)]';

  const dayOptions = useMemo(() => {
    const month = Number(form.dobMonth);
    const year = Number(form.dobYear);
    const max = daysInCalendarMonth(
      Number.isInteger(month) && month >= 1 ? month : 1,
      Number.isInteger(year) && year >= 1900 ? year : undefined,
    );
    // If month unset, offer 1–31; composeIso rejects impossible combos.
    const count =
      Number.isInteger(month) && month >= 1 ? max : 31;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [form.dobMonth, form.dobYear]);

  const dobIso = useMemo(() => {
    if (dobMode === 'text') return parseUkDateOfBirth(form.dobText);
    return composeIsoDateOfBirth(form.dobDay, form.dobMonth, form.dobYear);
  }, [dobMode, form.dobText, form.dobDay, form.dobMonth, form.dobYear]);
  const age = useMemo(
    () => (dobIso ? ageFromDateOfBirth(dobIso) : null),
    [dobIso],
  );
  const pwScore = useMemo(() => passwordScore(form.password), [form.password]);

  const completeRegistration = async (adultToken?: string) => {
    if (!adultToken) { setError('Complete the mandatory 18+ selfie check to continue.'); return; }
    setLoading(true);
    try {
      const isoDob =
        dobMode === 'text'
          ? parseUkDateOfBirth(form.dobText)
          : composeIsoDateOfBirth(form.dobDay, form.dobMonth, form.dobYear);
      const nextAge = isoDob ? ageFromDateOfBirth(isoDob) : null;
      if (!isoDob || nextAge == null || nextAge < 18) {
        setError(
          !isoDob
            ? dobMode === 'text'
              ? 'Enter your date of birth as dd/mm/yyyy.'
              : 'Select your date of birth.'
            : 'You must be 18 or older to sign up.',
        );
        setLoading(false);
        return;
      }
      const trimmedPromo = promoCode.trim();
      const trimmedReferral = referralCode.trim();
      if (trimmedPromo) {
        clearStoredPridePromoCode();
      }
      const res = await authAPI.register({
        name: form.displayName,
        email: form.email,
        age: nextAge,
        date_of_birth: isoDob,
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
      const { message, isDuplicateEmail: dup } = registerErrorMessage(err);
      setError(message);
      setIsDuplicateEmail(Boolean(dup));
      setShowAssurance(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!/^[A-Za-z0-9_-]{2,24}$/.test(form.displayName)) {
      setError('Display name must be 2–24 chars: letters, numbers, _ or -.');
      return;
    }
    if (!dobIso) {
      setError(
        dobMode === 'text'
          ? 'Enter your date of birth as dd/mm/yyyy.'
          : 'Select your date of birth.',
      );
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

    if (!adultAvailable) {
      setError('The required 18+ selfie check is currently unavailable. Please try again later.');
      return;
    }
    if (adultRequired) {
      setShowAssurance(true);
      return;
    }

    await completeRegistration();
  };

  const segColor = (idx: number): string => {
    if (pwScore <= idx) return '#3D2B0E';
    if (pwScore === 1) return '#A45E18';
    if (pwScore === 2) return '#C4832A';
    return '#D4943B';
  };

  const submitLabel = loading ? 'Creating account…' : 'Create Account';

  const assuranceHero =
    !showAssurance
      ? { title: 'Create your', accent: 'account.', copy: 'Pick a username and password.' }
      : assurancePhase === 'upsell' || assurancePhase === 'id' || assurancePhase === 'id_ok'
        ? {
            title: ADULT_ASSURANCE_COPY.upsellHeroTitle,
            accent: ADULT_ASSURANCE_COPY.upsellHeroAccent,
            copy: ADULT_ASSURANCE_COPY.upsellHeroSub,
          }
        : {
            title: ADULT_ASSURANCE_COPY.introHeroTitle,
            accent: ADULT_ASSURANCE_COPY.introHeroAccent,
            copy: ADULT_ASSURANCE_COPY.introHeroSub,
          };

  /** Age-check / upsell: brighter RandomBackground (Al lock). No fixed photo. */
  const assuranceBg = showAssurance
    ? {
        backgroundOpacity: AUTH_ASSURANCE_BACKGROUND_OPACITY,
        backgroundBrightness: AUTH_ASSURANCE_BRIGHTNESS,
        gradientOverlay: AUTH_ASSURANCE_GRADIENT,
      }
    : {
        backgroundOpacity: AUTH_BACKGROUND_OPACITY,
        backgroundBrightness: AUTH_BACKGROUND_BRIGHTNESS,
      };

  return (
    <PublicAuthShell {...assuranceBg}>
      <div lang="en-GB" className="contents">
      <PublicAuthHero
        title={assuranceHero.title}
        accent={assuranceHero.accent}
        copy={assuranceHero.copy}
      />

      {showAssurance ? (
        <AdultAssuranceFlow
          fixtureAllowed={fixtureAllowed}
          required={adultRequired}
          onPhaseChange={setAssurancePhase}
          onCancel={() => {
            setShowAssurance(false);
            setAssurancePhase('intro');
            clearError();
          }}
          onComplete={(result) => {
            if ('skip' in result) return;
            if ('underage' in result) {
              navigate('/register/underage', { replace: true });
              return;
            }
            if ('error' in result) {
              setError(result.error);
              setIsDuplicateEmail(false);
              setShowAssurance(false);
              setAssurancePhase('intro');
              return;
            }
            void completeRegistration(result.token);
          }}
        />
      ) : (
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
                data-testid="register-username-input"
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
              <span className={publicLabelClass} id="register-dob-label">
                Date of birth
              </span>
              {dobMode === 'select' ? (
                <div
                  className="grid grid-cols-3 gap-2"
                  role="group"
                  aria-labelledby="register-dob-label"
                  aria-describedby="register-dob-format"
                  data-testid="register-dob"
                >
                  <div className="min-w-0">
                    <label className="sr-only" htmlFor="register-dob-day">
                      Day
                    </label>
                    <select
                      id="register-dob-day"
                      name="bday-day"
                      autoComplete="bday-day"
                      required
                      value={form.dobDay}
                      onChange={onDobPartChange('dobDay')}
                      className={dobSelectClass}
                      data-testid="register-dob-day"
                    >
                      <option value="">Day</option>
                      {dayOptions.map((d) => (
                        <option key={d} value={String(d)}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className="sr-only" htmlFor="register-dob-month">
                      Month
                    </label>
                    <select
                      id="register-dob-month"
                      name="bday-month"
                      autoComplete="bday-month"
                      required
                      value={form.dobMonth}
                      onChange={onDobPartChange('dobMonth')}
                      className={dobSelectClass}
                      data-testid="register-dob-month"
                    >
                      <option value="">Month</option>
                      {UK_DOB_MONTHS.map((m) => (
                        <option key={m.value} value={String(m.value)}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className="sr-only" htmlFor="register-dob-year">
                      Year
                    </label>
                    <select
                      id="register-dob-year"
                      name="bday-year"
                      autoComplete="bday-year"
                      required
                      value={form.dobYear}
                      onChange={onDobPartChange('dobYear')}
                      className={dobSelectClass}
                      data-testid="register-dob-year"
                    >
                      <option value="">Year</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <input
                  id="register-dob-text"
                  type="text"
                  inputMode="text"
                  autoComplete="bday"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="dd/mm/yyyy"
                  value={form.dobText}
                  onChange={onDobTextChange}
                  required
                  maxLength={10}
                  aria-labelledby="register-dob-label"
                  aria-describedby="register-dob-format"
                  className={publicInputClass}
                  data-testid="register-dob-text"
                  lang="en-GB"
                />
              )}
              <p
                id="register-dob-format"
                className={helperClass}
                data-testid="register-dob-format"
              >
                You must be 18 or older.
              </p>
              <button
                type="button"
                className="self-start text-[13px] font-semibold text-[var(--cream-muted)] underline-offset-2 hover:text-[#C4832A] hover:underline"
                onClick={() => switchDobMode(dobMode === 'select' ? 'text' : 'select')}
                data-testid="register-dob-mode-toggle"
              >
                {dobMode === 'select' ? 'Type date instead' : 'Use day / month / year'}
              </button>
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
                  Promo code (optional)
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
                aria-label="Promo code"
                autoComplete="off"
                spellCheck={false}
                className={`${publicInputClass} font-mono tracking-[0.08em]`}
                data-testid="register-promo-input"
              />
              <p className={helperClass} data-testid="register-pride-note">
                Optional. If you have one.
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
                {ADULT_ASSURANCE_COPY.registerHelper}
              </p>
            ) : null}

            {error ? (
              <div className="flex flex-col gap-1.5" role="alert" data-testid="register-error-container">
                <p className={publicErrorClass} data-testid="register-error">
                  {error}
                </p>
                {isDuplicateEmail ? (
                  <p
                    className="text-[13px] leading-[1.55] text-[var(--cream-muted)]"
                    data-testid="register-duplicate-email-help"
                  >
                    <Link to="/login" className={publicLinkClass}>
                      Sign in
                    </Link>{' '}
                    or{' '}
                    <Link to="/forgot-password" className={publicLinkClass}>
                      reset your password
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className={helperClass} data-testid="register-gift-note">
              Sign up before 1 October 2026 and you get 30 days of Premium free. A promo
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
      )}
      </div>
    </PublicAuthShell>
  );
};
