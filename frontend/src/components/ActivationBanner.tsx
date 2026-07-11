import { Link } from 'react-router-dom';
import {
  activationBlockers,
  profileSetupProgress,
  type ProfileSetupSnapshot,
} from '../lib/profileSetup';

const BLOCKER_COPY: Record<ReturnType<typeof activationBlockers>[number], string> = {
  avatar: 'Add a photo or avatar',
  location: 'Turn on location',
  bio: 'Write your bio',
  looking: 'Say what you want',
  tags: 'Add at least 3 tags',
};

interface ActivationBannerProps {
  profile: ProfileSetupSnapshot;
}

/** Nudge incomplete profiles — premium copper strip, no nag beyond facts. */
export function ActivationBanner({ profile }: ActivationBannerProps) {
  const blockers = activationBlockers(profile);
  if (blockers.length === 0) return null;

  const progress = profileSetupProgress(profile);
  const headline =
    blockers[0] === 'avatar'
      ? 'You are invisible on the map'
      : blockers[0] === 'location'
        ? 'Guys cannot see how close you are'
        : 'Complete your profile — more views, more matches';

  return (
    <div
      className="mx-3 mb-3 rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      role="status"
      data-testid="activation-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-[#F0E0C0]">{headline}</p>
          <p className="mt-1 text-[12px] text-[#A89070]">
            {blockers.map((b) => BLOCKER_COPY[b]).join(' · ')}
          </p>
          <div className="mt-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[rgba(13,10,6,0.5)]">
            <div
              className="h-full rounded-full bg-[#C4832A] transition-all"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
        </div>
        <Link
          to="/profile/setup"
          className="shrink-0 rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
        >
          Finish profile
        </Link>
      </div>
    </div>
  );
}