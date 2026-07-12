import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usersAPI } from '../api/client';
import {
  activationBlockers,
  type ActivationBlocker,
  type ProfileSetupSnapshot,
} from '../lib/profileSetup';

const DEPTH_COPY: Partial<Record<ActivationBlocker, string>> = {
  avatar: 'Add a photo',
  bio: 'Write your bio',
  looking: 'Say what you want',
  tags: 'Add at least 3 tags',
};

/**
 * App-wide nudge when profile depth is incomplete (bio / looking / tags).
 * Location has its own strip; Discover has ActivationBanner — skip those shells.
 * 18+ product — hollow profiles kill match quality.
 */
export function ProfileDepthStrip() {
  const pathname = useLocation().pathname;
  const [gaps, setGaps] = useState<ActivationBlocker[]>([]);

  const hidden =
    pathname.startsWith('/discover') ||
    pathname.startsWith('/profile/setup') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/beta') ||
    pathname.startsWith('/coming-soon') ||
    pathname === '/';

  const refresh = useCallback(() => {
    usersAPI
      .getMe()
      .then((res) => {
        const blockers = activationBlockers(res.data as ProfileSetupSnapshot).filter(
          (b) => b !== 'location',
        );
        setGaps(blockers);
      })
      .catch(() => {
        setGaps([]);
      });
  }, []);

  useEffect(() => {
    if (hidden) return;
    refresh();
  }, [hidden, pathname, refresh]);

  if (hidden || gaps.length === 0) return null;

  const primary = gaps[0];
  const detail = gaps.map((g) => DEPTH_COPY[g] ?? g).join(' · ');

  return (
    <div
      className="border-b border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.1)] px-3 py-2.5"
      role="status"
      data-testid="profile-depth-strip"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-[#F0E0C0]">
            {primary === 'avatar'
              ? 'You need a photo to get matched'
              : 'Finish your profile — more views, more matches'}
          </p>
          <p className="text-[11px] text-[#A89070]">
            {detail}. Be direct. Consent first · 18+ only.
          </p>
        </div>
        <Link
          to="/profile/setup"
          data-testid="profile-depth-finish"
          className="shrink-0 rounded-full bg-[#C4832A] px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
        >
          Finish profile
        </Link>
      </div>
    </div>
  );
}
