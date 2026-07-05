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

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const res = await authAPI.login({ email, password });
      setAuth(res.data.user, res.data.token);
      if (nextPath) savePostAuthRedirect(nextPath);
      if (res.data.user?.is_verified) {
        navigate(consumePostAuthRedirect('/discover'));
      } else if (res.data.user?.verification_status === 'pending') {
        navigate('/verify/pending');
      } else {
        navigate('/verify');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const registerPath = BETA_INVITE_REQUIRED ? '/beta' : '/register';

  return (
    <PublicAuthShell
      backgroundImage={AUTH_BACKGROUNDS.login}
      coinFlip={{ qrValue: 'https://menrush.com', noFlip: true }}
    >
      <PublicAuthHero
        title="Sign in and see who's"
        accent="near you right now."
        copy="For invite holders only. Use the email and password from your invite."
      />

      <div className={publicPanelClass}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="••••••••"
              required
              className={publicInputClass}
            />
          </div>

          {error ? <p className={publicErrorClass}>{error}</p> : null}

          <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
            {loading ? (
              <>
                <PulseRing size={16} /> Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="flex flex-col gap-3 text-[15px] text-[#A89070]">
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
