import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { consumePostAuthRedirect, safeNextPath, savePostAuthRedirect } from '../lib/profileLinks';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { PulseRing } from '../components/PulseRing';
import {
  publicErrorClass,
  publicInputClass,
  publicLabelClass,
  publicLinkClass,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';
import { BETA_INVITE_REQUIRED } from '../lib/betaInvite';
import { FEATURES } from '../lib/featureFlags';
import { PasswordInput } from '../components/PasswordInput';
import { loginErrorMessage } from '../lib/authErrors';
import {
  clearDeviceTrustToken,
  getDeviceTrustToken,
  saveDeviceTrustToken,
} from '../lib/deviceTrust';

type LoginUser = {
  email?: string;
  is_verified?: boolean;
  verification_status?: string;
};

function routeAfterLogin(navigate: ReturnType<typeof useNavigate>, user: LoginUser, nextPath: string | null) {
  if (nextPath) savePostAuthRedirect(nextPath);
  if (!FEATURES.requireIdVerification || user?.is_verified) {
    navigate(consumePostAuthRedirect('/discover'));
  } else if (user?.verification_status === 'pending') {
    navigate('/verify/pending');
  } else if (user?.verification_status === 'rejected') {
    navigate('/verify/rejected');
  } else {
    navigate('/verify/id');
  }
}

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [trustThisDevice, setTrustThisDevice] = useState(true);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<LoginUser | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const nextPath = safeNextPath(searchParams.get('next'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (pendingToken) {
        const res = await authAPI.verifyTwoFactorLogin({
          pendingToken,
          code: twoFactorCode,
          trustThisDevice,
        });
        const trustEmail = pendingUser?.email || email;
        if (res.data.deviceTrustToken && trustEmail) {
          saveDeviceTrustToken(trustEmail, res.data.deviceTrustToken);
        } else if (!trustThisDevice) {
          clearDeviceTrustToken();
        }
        setAuth(res.data.user, res.data.token);
        routeAfterLogin(navigate, res.data.user, nextPath);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const deviceTrustToken = getDeviceTrustToken(normalizedEmail);
      const res = await authAPI.login({
        email: normalizedEmail,
        password,
        ...(deviceTrustToken ? { deviceTrustToken } : {}),
      });
      if (res.data.requires2fa) {
        // Stale or revoked trust token — drop it so we don't keep sending it.
        if (deviceTrustToken) clearDeviceTrustToken();
        setPendingToken(res.data.pendingToken);
        setPendingUser(res.data.user);
        setTwoFactorCode('');
        setTrustThisDevice(true);
        return;
      }

      if (res.data.deviceTrustToken) {
        saveDeviceTrustToken(normalizedEmail, res.data.deviceTrustToken);
      }
      setAuth(res.data.user, res.data.token);
      routeAfterLogin(navigate, res.data.user, nextPath);
    } catch (err: unknown) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const registerPath = BETA_INVITE_REQUIRED ? '/beta' : '/register';

  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.login}>
      <PublicAuthHero
        title={pendingToken ? 'Enter your' : "Sign in and see who's"}
        accent={pendingToken ? 'authenticator code.' : 'near you right now.'}
        copy={
          pendingToken
            ? `Two-factor authentication is on for ${pendingUser?.email ?? 'your account'}. Open your authenticator app and enter the current 6-digit code.`
            : 'For invite holders only. Use the email and password from your invite.'
        }
      />

      <div className={publicPanelClass}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {!pendingToken ? (
            <>
              <div className="flex flex-col gap-2.5">
                <label htmlFor="login-email" className={publicLabelClass}>
                  Username / Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="you@example.com"
                  required
                  className={publicInputClass}
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <label htmlFor="login-password" className={publicLabelClass}>
                  Password
                </label>
                <PasswordInput
                  id="login-password"
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    setError('');
                  }}
                  className={publicInputClass}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2.5">
              <label htmlFor="login-2fa" className={publicLabelClass}>
                Authenticator code
              </label>
              <input
                id="login-2fa"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => {
                  setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="000000"
                required
                className={`${publicInputClass} text-center text-lg font-bold tracking-[0.35em]`}
              />
              <button
                type="button"
                onClick={() => {
                  setPendingToken(null);
                  setPendingUser(null);
                  setTwoFactorCode('');
                  setTrustThisDevice(true);
                  setError('');
                }}
                className="self-start text-sm font-semibold text-[var(--cream-muted)] transition-colors hover:text-[#C4832A]"
              >
                Use a different account
              </button>
              <label
                htmlFor="login-trust-device"
                className="mt-1 flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(196,131,42,0.22)] bg-[rgba(196,131,42,0.06)] px-3.5 py-3"
              >
                <input
                  id="login-trust-device"
                  type="checkbox"
                  checked={trustThisDevice}
                  onChange={(e) => setTrustThisDevice(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C4832A]/50 accent-[#C4832A]"
                />
                <span className="text-left">
                  <span className="block text-sm font-semibold text-[var(--cream)]">
                    Trust this device
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[var(--cream-muted)]">
                    Skip the authenticator code on this browser for 30 days. Password still required.
                  </span>
                </span>
              </label>
            </div>
          )}

          {error ? <p className={publicErrorClass}>{error}</p> : null}

          <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
            {loading ? (
              <>
                <PulseRing size={16} /> {pendingToken ? 'Verifying…' : 'Signing in…'}
              </>
            ) : pendingToken ? (
              'Verify and sign in'
            ) : (
              'Sign In'
            )}
          </button>

          <div className="flex flex-col gap-3 text-[15px] text-[var(--cream-muted)]">
            <p className="m-0">
              Selected for beta?{' '}
              <Link to={registerPath} className={publicLinkClass}>
                Create an account
              </Link>
            </p>
            <Link to="/forgot-password" className={publicLinkClass}>
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </PublicAuthShell>
  );
};
