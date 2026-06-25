import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { CoinFlip } from '../components/CoinFlip';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SiteFooter } from '../components/SiteFooter';

interface FormState {
  displayName: string;
  email: string;
  dob: string;
  password: string;
  ageConsent: boolean;
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
  const [form, setForm] = useState<FormState>({
    displayName: '',
    email: '',
    dob: '',
    password: '',
    ageConsent: false,
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
      setError('Please confirm both consent checkboxes.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.register({
        name: form.displayName,
        email: form.email,
        age: age ?? 0,
        password: form.password,
      });
      setAuth(res.data.user, res.data.token);
      navigate(res.data.user?.is_verified ? '/discover' : '/verify');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-[#1E1508]/60 border border-[#3D2B0E] text-[#F0E0C0] placeholder:text-[#A89070]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4832A]/50 focus:border-[#C4832A]/50 transition-all duration-200';

  const labelClass = 'block text-xs font-bold text-[#A89070] mb-1.5 uppercase tracking-wide';
  const helperClass = 'text-[11px] text-[#A89070]/70 mt-1.5 leading-snug';

  const segColor = (idx: number): string => {
    if (pwScore <= idx) return '#3D2B0E';
    if (pwScore === 1) return '#8B4513';
    if (pwScore === 2) return '#C4832A';
    return '#D4943B';
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-6 flex justify-center">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <CoinFlip qrValue="https://menrush.com" sizeClass="h-24" />
            </Link>
          </div>

        <div className="bg-[#1E1508]/80 backdrop-blur-xl border border-[#3D2B0E] rounded-2xl p-6 shadow-card">
          <h1 className="text-lg font-bold text-[#F0E0C0] mb-5">Create account</h1>

          {error && (
            <div className="flex items-start gap-2.5 bg-[#8B4513]/10 border border-[#8B4513]/25 text-[#F0E0C0]/90 px-4 py-3 rounded-xl mb-4 text-sm animate-fade-in">
              <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Display Name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={setField('displayName')}
                placeholder="e.g. Jamie"
                aria-label="Display name"
                required
                minLength={2}
                maxLength={24}
                className={inputClass}
              />
              <p className={helperClass}>
                This is what other men see. First name, nickname, or handle. Doesn't need to be real.
              </p>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={setField('email')}
                placeholder="you@example.com"
                aria-label="Email address"
                required
                className={inputClass}
              />
              <p className={helperClass}>Verification link sent here. We never share it.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={setField('dob')}
                  aria-label="Date of birth"
                  required
                  className={inputClass}
                />
                <p className={helperClass}>18+ verified via ID after sign-up.</p>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={setField('password')}
                  placeholder="Min 12 chars, mixed case, 1 number"
                  required
                  minLength={12}
                  className={inputClass}
                />
                <div className="flex gap-1 mt-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="flex-1 h-1 rounded-full transition-colors"
                      style={{ background: segColor(i) }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#F0E0C0]/85 leading-snug cursor-pointer">
              <input
                type="checkbox"
                checked={form.ageConsent}
                onChange={setField('ageConsent')}
                required
                className="mt-0.5 w-4 h-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
              />
              <span>I confirm I am 18 years or older.</span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-[#F0E0C0]/85 leading-snug cursor-pointer">
              <input
                type="checkbox"
                checked={form.legalConsent}
                onChange={setField('legalConsent')}
                required
                className="mt-0.5 w-4 h-4 rounded border-[#3D2B0E] bg-[#1E1508] accent-[#C4832A]"
              />
              <span>
                I have read and accept the{' '}
                <a href="/terms" className="text-[#C4832A] hover:text-[#D4943B] underline-offset-2 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-[#C4832A] hover:text-[#D4943B] underline-offset-2 hover:underline">
                  Privacy Policy
                </a>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-1 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-bold text-sm tracking-wide transition-all duration-200 hover:shadow-glow-blue active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <><PulseRing size={16} /> Creating account…</> : '→ CREATE ACCOUNT'}
            </button>
            <p className="text-[11px] text-[#A89070]/80 text-center mt-2">
              Next: verify your email, then your ID. Takes 3 minutes.
            </p>
          </form>

          <p className="text-center mt-5 text-xs text-[#A89070]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#C4832A] hover:text-[#D4943B] font-semibold transition-colors">
              Sign In
            </Link>
          </p>
        </div>
        </div>
      </div>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
