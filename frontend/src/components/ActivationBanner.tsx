import { Link } from 'react-router-dom';
import {
  activationBlockers,
  isDiscoverLocationReady,
  needsRealPhotoUpgrade,
  profileSetupProgress,
  type ProfileSetupSnapshot,
} from '../lib/profileSetup';

const BLOCKER_COPY: Record<ReturnType<typeof activationBlockers>[number], string> = {
  avatar: 'Add a photo or avatar',
  location: 'Allow location (private — not a public pin)',
  bio: 'Write your bio',
  looking: 'Say what you want',
  tags: 'Add at least 3 tags',
};

interface ActivationBannerProps {
  profile: ProfileSetupSnapshot;
  /** Browser GPS grant — used when location is the primary gap. */
  onEnableLocation?: () => void;
}

/** Nudge incomplete profiles — premium copper strip, no nag beyond facts. */
export function ActivationBanner({ profile, onEnableLocation }: ActivationBannerProps) {
  const blockers = activationBlockers(profile);
  const needsLocation = !isDiscoverLocationReady(profile);
  const photoUpgrade = blockers.length === 0 && !needsLocation && needsRealPhotoUpgrade(profile);
  if (blockers.length === 0 && !needsLocation && !photoUpgrade) return null;

  const progress = profileSetupProgress(profile);
  const primary = blockers[0];
  const headline = photoUpgrade
    ? 'Shared avatar — real photos get matched first'
    : primary === 'avatar'
      ? 'You are invisible on the map'
      : primary === 'location' || (needsLocation && blockers.length === 0)
        ? 'We need your location — others only see distance'
        : 'Complete your profile — more views, more matches';

  const showLocationCta =
    !photoUpgrade && (primary === 'location' || needsLocation) && Boolean(onEnableLocation);

  return (
    <div
      className="mx-3 mb-3 rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      role="status"
      data-testid={photoUpgrade ? 'activation-photo-upgrade' : 'activation-banner'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-[#F0E0C0]">{headline}</p>
          <p className="mt-1 text-[12px] text-[#A89070]">
            {photoUpgrade
              ? 'Upload a clear face or upper-body shot. Men nearby rank real photos higher · 18+ only.'
              : blockers.length > 0
                ? blockers.map((b) => BLOCKER_COPY[b]).join(' · ')
                : 'We need GPS for Nearby. You are not broadcasting an exact public pin — only approximate distance.'}
          </p>
          <div className="mt-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[rgba(13,10,6,0.5)]">
            <div
              className="h-full rounded-full bg-[#C4832A] transition-all"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {photoUpgrade ? (
            <Link
              to="/profile"
              data-testid="activation-add-real-photo"
              className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Add real photo
            </Link>
          ) : showLocationCta ? (
            <button
              type="button"
              onClick={onEnableLocation}
              data-testid="activation-enable-location"
              className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Allow location
            </button>
          ) : (
            <Link
              to="/profile/setup"
              className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Finish profile
            </Link>
          )}
          {showLocationCta ? (
            <Link
              to="/profile/setup"
              className="rounded-full border border-[rgba(196,131,42,0.5)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
            >
              Profile
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
