import { Link } from 'react-router-dom';
import {
  activationBlockers,
  isDiscoverLocationReady,
  isLocationOnlyGap,
  isProfileSetupComplete,
  profileFieldBlockers,
  profileSetupProgress,
  type ProfileSetupSnapshot,
} from '../lib/profileSetup';
import { usePromptDismissal } from '../lib/promptDismissal';
import { usePromptSlot } from '../lib/promptSlot';
import { PromptDismissControls } from './PromptDismissControls';

const BLOCKER_COPY: Record<ReturnType<typeof activationBlockers>[number], string> = {
  avatar: 'Photo',
  location: 'Location',
  bio: 'Bio',
  looking: 'Looking for',
  tags: '3 tags',
};

interface ActivationBannerProps {
  profile: ProfileSetupSnapshot;
  /** Browser GPS grant — used when location is the primary gap. */
  onEnableLocation?: () => void;
}

/**
 * Nudge incomplete profiles only (missing avatar / location / bio / looking / tags).
 * Soft “upgrade shared avatar → real photo” nags were removed — once you have any
 * avatar, we stop reminding you to replace it on every visit.
 */
export function ActivationBanner({ profile, onEnableLocation }: ActivationBannerProps) {
  const blockers = activationBlockers(profile);
  const fieldGaps = profileFieldBlockers(profile);
  const needsLocation = !isDiscoverLocationReady(profile);
  const locationOnly = isLocationOnlyGap(profile);
  const fieldsComplete = isProfileSetupComplete(profile);
  const profileDismissal = usePromptDismissal('profile');
  const nothingMissing = blockers.length === 0 && !needsLocation;

  const progress = profileSetupProgress(profile);
  const primary = blockers[0];
  const headline =
    locationOnly || (needsLocation && fieldsComplete)
      ? 'Turn on location'
      : primary === 'avatar'
        ? 'You are invisible on the map'
        : primary === 'location'
          ? 'Turn on location'
          : 'Finish your profile';

  const showLocationCta =
    (locationOnly || primary === 'location' || (needsLocation && fieldsComplete)) &&
    Boolean(onEnableLocation);

  // Missing GPS is not "finish profile" — never dump a fields-complete user onto the wizard.
  const showFinishProfileCta = !showLocationCta && fieldGaps.length > 0;

  // Finish-profile mode honours "Don't show again". A complete profile never
  // reaches this mode; the location prompt is separate and unchanged.
  const finishProfileMode = !nothingMissing && !fieldsComplete && !showLocationCta;

  // One prompt at a time: in Finish profile mode this waits behind Get the app
  // and alerts. The location prompt is not part of that order.
  const finishOnTop = usePromptSlot(
    'profile',
    finishProfileMode && !profileDismissal.hidden ? 'want' : 'none',
  );

  if (nothingMissing) return null;
  if (finishProfileMode && (profileDismissal.hidden || !finishOnTop)) return null;

  return (
    <div
      className="mx-3 mb-3 rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      role="status"
      data-testid="activation-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-[var(--cream)]">{headline}</p>
          <p className="mt-1 text-[15px] text-[var(--cream-muted)]">
            {locationOnly || (needsLocation && fieldsComplete)
              ? "We use your location to show who's nearby."
              : blockers.length > 0
                ? `Missing: ${blockers.map((b) => BLOCKER_COPY[b]).join(' · ')}`
                : "We use your location to show who's nearby."}
          </p>
          <div className="mt-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[rgba(13,10,6,0.5)]">
            <div
              className="h-full rounded-full bg-[#C4832A] transition-all"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {showLocationCta ? (
            <button
              type="button"
              onClick={onEnableLocation}
              data-testid="activation-enable-location"
              className="inline-flex min-h-[44px] items-center rounded-full bg-[#C4832A] px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Allow location
            </button>
          ) : showFinishProfileCta ? (
            <Link
              to="/profile/setup"
              data-testid="activation-finish-profile"
              className="inline-flex min-h-[44px] items-center rounded-full bg-[#C4832A] px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Finish profile
            </Link>
          ) : null}
          {showLocationCta ? (
            <Link
              to="/settings"
              data-testid="activation-location-settings"
              className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--nn-accent-text)] px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide text-[var(--nn-accent-text)] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
            >
              Settings
            </Link>
          ) : null}
        </div>
      </div>
      {finishProfileMode ? (
        <PromptDismissControls
          onClose={profileDismissal.close}
          closeLabel="Close finish your profile"
          testIdPrefix="profile-prompt"
          className="mt-1"
        />
      ) : null}
    </div>
  );
}
