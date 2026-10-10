import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { isYouRowsPath } from '../lib/youRows';
import {
  isProfileSetupComplete,
  profileFieldBlockers,
  type ActivationBlocker,
  type ProfileSetupSnapshot,
} from '../lib/profileSetup';
import { usePromptDismissal } from '../lib/promptDismissal';
import { usePromptSlot } from '../lib/promptSlot';
import { PromptDismissControls } from './PromptDismissControls';

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
  const dismissal = usePromptDismissal('profile');

  const hidden =
    pathname.startsWith('/discover') ||
    pathname.startsWith('/profile/setup') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/coming-soon') ||
    isYouRowsPath(pathname) ||
    pathname === '/';

  const refresh = useCallback(() => {
    usersAPI
      .getMe()
      .then((res) => {
        const profile = res.data as ProfileSetupSnapshot | null | undefined;
        // Same "complete" rule as setup and Discover: photo, bio of 20+, looking for, 3 tags.
        setGaps(profile && !isProfileSetupComplete(profile) ? profileFieldBlockers(profile) : []);
      })
      .catch(() => {
        setGaps([]);
      });
  }, []);

  useEffect(() => {
    if (hidden || dismissal.hidden) return;
    refresh();
  }, [hidden, dismissal.hidden, pathname, refresh]);

  // One prompt at a time: Finish profile waits behind Get the app and alerts.
  const wants = !hidden && !dismissal.hidden && dismissal.ready && gaps.length > 0;
  const onTop = usePromptSlot('profile', wants ? 'want' : 'none');

  const visible = wants && onTop;
  const { markShown } = dismissal;
  // Once on screen it stays until closed, whatever the server prefs say later.
  useEffect(() => {
    if (visible) markShown();
  }, [visible, markShown]);

  if (!visible) return null;

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
          <p className="text-base font-extrabold text-[var(--cream)]">
            {primary === 'avatar'
              ? 'Add a photo'
              : 'Finish your profile'}
          </p>
          <p className="text-[15px] text-[var(--cream-muted)]" data-testid="profile-depth-body">
            {detail}. Be direct. Consent first.
          </p>
        </div>
        <Link
          to="/profile/setup"
          data-testid="profile-depth-finish"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-[#C4832A] px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
        >
          Finish profile
        </Link>
        <PromptDismissControls
          onClose={dismissal.close}
          closeLabel="Close finish your profile"
          testIdPrefix="profile-prompt"
          className="w-full"
        />
      </div>
    </div>
  );
}
