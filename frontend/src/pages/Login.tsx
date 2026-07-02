import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { consumePostAuthRedirect, safeNextPath, savePostAuthRedirect } from '../lib/profileLinks';
import { CoinFlip } from '../components/CoinFlip';
import { PublicHeroBlock, PublicMarketingShell } from '../components/PublicMarketingShell';
import { PulseRing } from '../components/PulseRing';
import {
  publicHeroLogoClass,
  publicInputClass,
  publicLabelClass,
  publicNavLinkPrimary,
  publicNavLinkSecondary,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';

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

  return (
    <PublicMarketingShell
      header={
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link to="/register" className={publicNavLinkPrimary}>
            Sign up
          </Link>
          <Link to="/coming-soon#waitlist" className={publicNavLinkSecondary}>
            Waitlist
          </Link>
        </nav>
      }
      hero={
        <>
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
            <CoinFlip qrValue="https://menrush.com" sizeClass={publicHeroLogoClass} noFlip />
          </Link>
          <PublicHeroBlock
            title="Sign in and see who's"
            accent="near you right now."
            copy="New here? Create an account, then verify with a government ID and matching selfie before you can discover or chat."
          />
        </>
      }
      panel={
        <div className={publicPanelClass}>
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#8B4513]/30 bg-[#8B4513]/12 px-4 py-3 text-sm text-[#F0E0C0]/90 backdrop-blur-md animate-fade-in">
              <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className={publicLabelClass}>
                Username / Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={publicInputClass}
              />
            </div>

            <div>
              <label htmlFor="login-password" className={publicLabelClass}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={publicInputClass}
              />
            </div>

            <button type="submit" disabled={loading} className={publicPrimaryButtonClass}>
              {loading ? (
                <>
                  <PulseRing size={16} /> Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-5 flex flex-col gap-3 text-sm text-[#F0E0C0]/72 sm:flex-row sm:items-center sm:justify-between">
            <p>
              New here?{' '}
              <Link to="/register" className="font-semibold text-[#C4832A] transition-colors hover:text-[#D4943B]">
                Create an account
              </Link>
            </p>
            <Link
              to="/forgot-password"
              className="shrink-0 font-medium text-[#C4832A] transition-colors hover:text-[#D4943B]"
            >
              Forgot password?
            </Link>
          </div>
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
