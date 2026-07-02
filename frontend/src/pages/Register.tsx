import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { getValidatedBetaInviteCode } from '../lib/betaInvite';
import { CoinFlip } from '../components/CoinFlip';
import { PublicHeroBlock, PublicMarketingShell } from '../components/PublicMarketingShell';
import { PulseRing } from '../components/PulseRing';
import {
  publicHeroLogoClass,
  publicInputClass,
  publicLabelClass,
  publicNavLinkSecondary,
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
  const betaInviteCode = getValidatedBetaInviteCode();
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

  const setField = <K extends keyof FormState>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({
        ...prev,
        [field]:
          (e.target as HTMLInputElement).type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : e.target.value,
      }) as FormState);

  const age = useMemo(() => calcAge(form.dob), [form.dob]);
  const pwScore = useMemo(() => passwordScore(form.password), [form.password]);

  if (!betaInviteCode) {
    return <Navigate to="/register" replace />;
  }

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

    setLoading(true);
    try {
      const res = await authAPI.register({
        name: form.displayName,
        email: form.email,
        age: age ?? 0,
        password: form.password,
        beta_invite_code: betaInviteCode,
      });
      setAuth(res.data.user, res.data.token);
      navigate('/verify');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const helperClass = 'text-[11px] text-[#A89070]/70 mt-1.5 leading-snug';

  const segColor = (idx: number): string => {
    if (pwScore <= idx) return '#3D2B0E';
    if (pwScore === 1) return '#8B4513';
    if (pwScore === 2) return '#C4832A';
    return '#D4943B';
  };

  return (
    <PublicMarketingShell
      header={
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link to="/login" className={publicNavLinkSecondary}>
            Sign in
          </Link>
          <Link to="/" className={publicNavLinkSecondary}>
            Waitlist
          </Link>
        </nav>
      }
      hero={
        <>
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
            <CoinFlip qrValue="https://menrush.com" sizeClass={publicHeroLogoClass} />
          </Link>
          <PublicHeroBlock
            title="Create your account"
            accent="and get verified."
            copy="Government ID plus a matching selfie before you can discover or chat. Usually under three minutes."
          />
        </>
      }
      panel={
        <div className={`${publicPanelClass} max-h-[min(70dvh,720px)] overflow-y-auto lg:max-h-none lg:overflow-visible`}>
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90 backdrop-blur-md animate-fade-in">
              <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={publicLabelClass}>Display Name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={setField('displayName')}
                placeholder="e.g. Jamie"
                aria-label="Display name"
                required
                minLength={2}
                maxLength={24}
                className={publicInputClass}
              />
              <p className={helperClass}>
                This is what other men see. First name, nickname, or handle. Doesn&apos;t need to be real.
              </p>
            </div>

            <div>
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
              <p className={helperClass}>Used for login and account recovery. We never share it.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
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
              <div>
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
                <div className="mt-2 flex gap-1">
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

            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-[#F0E0C0]/85">
              <input
                type="checkbox"
                checked={form.ageConsent}
                onChange={setField('ageConsent')}
                required
                className="mt-0.5 h-4 w-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
              />
              <span>I confirm I am 18 years or older.</span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-[#F0E0C0]/85">
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

            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-[#F0E0C0]/85">
              <input
                type="checkbox"
                checked={form.legalConsent}
                onChange={setField('legalConsent')}
                required
                className="mt-0.5 h-4 w-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
              />
              <span>
                I have read and accept the{' '}
                <Link to="/terms" className="text-[#C4832A] underline-offset-2 hover:text-[#D4943B] hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-[#C4832A] underline-offset-2 hover:text-[#D4943B] hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
              {loading ? (
                <>
                  <PulseRing size={16} /> Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-[#A89070]/80">
              Next: government ID + matching selfie.
            </p>
          </form>

          <p className="mt-5 text-center text-xs text-[#A89070]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]">
              Sign in
            </Link>
          </p>
        </div>
      }
    />
  );
};

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
