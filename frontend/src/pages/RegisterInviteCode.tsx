import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { PulseRing } from '../components/PulseRing';
import {
  BetaLaunchBrandHeader,
  BetaLaunchHero,
  BetaLaunchShell,
} from '../components/BetaLaunchShell';
import { saveValidatedBetaInviteCode } from '../lib/betaInvite';
import {
  publicInputClass,
  publicLabelClass,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';

const BACKGROUND = '/images/menrush/21-pride-parade-flags.jpeg';
const CODE_PATTERN = /^MR-BETA-[A-Z0-9]{4,}$/;

export const RegisterInviteCode = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const trimmed = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(trimmed)) {
      setError('That code is not valid. Check your invite email.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.validateBetaInviteCode({ code: trimmed });
      const normalized = String(res.data.code || trimmed).trim().toUpperCase();
      saveValidatedBetaInviteCode(normalized);

      if (res.data.registration_open) {
        navigate('/register/create');
        return;
      }

      setError(
        res.data.message ||
          "You're selected for beta. Account creation isn't open yet — we'll email you when your code can be used.",
      );
      setCode('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 404) {
        setError('Beta invite checks are not live yet. Please try again closer to launch.');
        return;
      }
      setError(
        axiosErr.response?.data?.error || 'That code is not recognized. Beta access is invite-only.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <BetaLaunchShell backgroundImage={BACKGROUND} showFooter>
      <BetaLaunchBrandHeader />
      <BetaLaunchHero
        title="Beta access is"
        accent="invite-only."
        copy="MenRush hasn't launched publicly yet. If you were selected for beta, enter the unique code from your invite email below."
      />

      <div className={publicPanelClass}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2.5">
            <label htmlFor="beta-invite-code" className={publicLabelClass}>
              Beta invite code
            </label>
            <input
              id="beta-invite-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="E.G. MR-BETA-XXXX"
              autoComplete="off"
              spellCheck={false}
              required
              className={`${publicInputClass} font-mono tracking-wider`}
            />
          </div>

          {error ? (
            <p className="m-0 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90">
              {error}
            </p>
          ) : null}

          <p className="m-0 text-sm leading-snug text-[#A89070]">
            Codes are single-use and tied to selected waitlist members. No code?{' '}
            <Link
              to="/"
              className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]"
            >
              Join the waitlist
            </Link>
            .
          </p>

          <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
            {loading ? (
              <>
                <PulseRing size={16} /> Checking code…
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <p className="text-center text-[15px] text-[#A89070]">
          Already have an account?{' '}
          <Link
            to="/signin"
            className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </BetaLaunchShell>
  );
};