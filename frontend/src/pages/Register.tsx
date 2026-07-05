import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { PulseRing } from '../components/PulseRing';
import {
  BETA_INVITE_REQUIRED,
  readStoredInviteCode,
  storeInviteCode,
} from '../lib/betaInvite';
import {
  publicErrorClass,
  publicInputClass,
  publicInviteChipClass,
  publicLabelClass,
  publicLinkClass,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';

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

export const Register = () => {
  const [searchParams] = useSearchParams();
  const inviteFromQuery = searchParams.get('invite')?.trim() || '';
  const [inviteCode] = useState(() => inviteFromQuery || readStoredInviteCode() || '');
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
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (inviteFromQuery) {
      storeInviteCode(inviteFromQuery);
    }
  }, [inviteFromQuery]);

  useEffect(() => {
    if (BETA_INVITE_REQUIRED && !inviteCode) {
      navigate('/beta', { replace: true });
    }
  }, [inviteCode, navigate]);

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
    if (!form.ageConsent || !form.idConsent || !form.legalConsent) {
      setError('Please confirm all consent checkboxes.');
      return;
    }
    if (BETA_INVITE_REQUIRED && !inviteCode) {
      setError('A beta invite code is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.register({
        name: form.displayName,
        email: form.email,
        age: age ?? 0,
        password: form.password,
        ...(BETA_INVITE_REQUIRED ? { invite_code: inviteCode } : {}),
      });
      setAuth(res.data.user, res.data.token);
      navigate('/verify');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const helperClass = 'text-[13px] leading-[1.55] text-[#A89070]';

  const segColor = (idx: number): string => {
    if (pwScore <= idx) return '#3D2B0E';
    if (pwScore === 1) return '#8B4513';
    if (pwScore === 2) return '#C4832A';
    return '#D4943B';
  };

  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.register}>
      <PublicAuthHero
        title="You're in."
        accent="Set up your account."
        copy="Your invite code checks out. Pick a username and password to join the beta."
      />

      <div className={`${publicPanelClass} max-h-[min(70dvh,720px)] overflow-y-auto lg:max-h-none lg:overflow-visible`}>
        {BETA_INVITE_REQUIRED && inviteCode ? (
          <div className={publicInviteChipClass}>
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#E0A14A]">
              Invite code
            </span>
            <span className="font-mono text-sm tracking-[0.12em] text-[#F0E0C0]">{inviteCode}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <label className={publicLabelClass}>Username</label>
            <input
              type="text"
              value={form.displayName}
              onChange={setField('displayName')}
              placeholder="What men will see"
              aria-label="Display name"
              required
              minLength={2}
              maxLength={24}
              className={publicInputClass}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className={publicLabelClass}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={setField('email')}
              placeholder="you@example.com"
              aria-label="Email address"
              required
              className={publicInputClass}
            />
            <p className={helperClass}>Use the email your invite was sent to.</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <label className={publicLabelClass}>Date of Birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={setField('dob')}
                aria-label="Date of birth"
                required
                className={publicInputClass}
              />
              <p className={helperClass}>Must match the date on your government ID.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <label className={publicLabelClass}>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={setField('password')}
                placeholder="Min 12 chars, mixed case, 1 number"
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

          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#A89070]">
            <input
              type="checkbox"
              checked={form.ageConsent}
              onChange={setField('ageConsent')}
              required
              className="mt-0.5 h-4 w-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
            />
            <span>I confirm I am 18 years or older.</span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#A89070]">
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

          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#A89070]">
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
              .
            </span>
          </label>

          {error ? <p className={publicErrorClass}>{error}</p> : null}

          <p className={helperClass}>
            18+ only. Every member is ID verified and selfie matched before going live.
          </p>

          <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
            {loading ? (
              <>
                <PulseRing size={16} /> Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>

          <p className="m-0 text-center text-[15px] text-[#A89070]">
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
