import type { NearbyUser } from './ProfileCard';
import { SilhouetteAvatar } from './SilhouetteAvatar';
import { VerifiedBadge } from './VerifiedBadge';
import { useResolvingPhotoSrc } from './UserAvatar';
import { ProfilePhotoLink } from './ProfilePhotoLink';
import { formatActiveStatus, formatDistanceMiles, getTribeTag } from '../lib/discoveryFormat';
import {
  PROFILE_TILE_GRID_CLASS,
  PROFILE_TILE_SKELETON_CLASS,
} from '../lib/profileTileGrid';
import { Link } from 'react-router-dom';

interface NearbyProfileGridProps {
  users: NearbyUser[];
  loading: boolean;
  /**
   * Optional legacy callback. When omitted, photo taps navigate via ProfilePhotoLink
   * (self → /profile, else → /profile/:id).
   */
  onSelect?: (user: NearbyUser) => void;
  /** One-tap match without opening the drawer — primary engagement path. */
  onMatch?: (user: NearbyUser) => void | Promise<void>;
  likedUserIds?: Set<string>;
  /** Mutual matches only — Open chat path (messaging requires mutual). */
  mutualUserIds?: Set<string>;
  matchingUserId?: string | null;
  /** Expand search radius — cold-start density for beta. */
  onExpandRadius?: () => void;
  /** Jump to profile setup when location/avatar incomplete. */
  onFinishProfile?: () => void;
  /** Turn on Pulse to become more visible when density is empty. */
  onStartPulse?: () => void;
  pulseOn?: boolean;
  /** When set, empty-state Pulse CTA stays clickable but explains the block. */
  pulseBlockedReason?: string | null;
  /** Venue check-ins when the map is quiet. */
  onOpenHotSpots?: () => void;
  radiusLabel?: string;
  /** Count of men at max radius when current radius is empty. */
  beyondRadiusCount?: number;
}

export function NearbyProfileGrid({
  users,
  loading,
  onSelect,
  onMatch,
  likedUserIds,
  mutualUserIds,
  matchingUserId,
  onExpandRadius,
  onFinishProfile,
  onStartPulse,
  pulseOn,
  pulseBlockedReason,
  onOpenHotSpots,
  radiusLabel,
  beyondRadiusCount = 0,
}: NearbyProfileGridProps) {
  if (loading && users.length === 0) {
    return (
      <div
        className={PROFILE_TILE_GRID_CLASS}
        data-testid="nearby-profile-grid-loading"
      >
        {[...Array(6)].map((_, i) => (
          <div key={i} className={PROFILE_TILE_SKELETON_CLASS} />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div
        className="rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.08)] px-5 py-10 text-center shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        data-testid="discover-empty-density"
        role="status"
      >
        <p className="text-[16px] font-extrabold text-[var(--cream)]">No men in this radius yet</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--cream-muted)]">
          {beyondRadiusCount > 0 ? (
            <>
              <span className="font-bold text-[#E0A14A]">
                {beyondRadiusCount === 1
                  ? '1 man is farther out'
                  : `${beyondRadiusCount} men are farther out`}
              </span>
              . Expand beyond
              {radiusLabel ? ` ${radiusLabel}` : ' this range'} to see them.
            </>
          ) : (
            <>
              Expand your range
              {radiusLabel ? ` (now ${radiusLabel})` : ''}, turn on location, and finish your profile
              so others can find you.
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onExpandRadius ? (
            <button
              type="button"
              onClick={onExpandRadius}
              data-testid="empty-expand-radius"
              className="min-h-[44px] rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              {beyondRadiusCount > 0 ? 'Expand to find them' : 'Expand radius'}
            </button>
          ) : null}
          {onStartPulse && !pulseOn ? (
            <button
              type="button"
              onClick={onStartPulse}
              data-testid="empty-start-pulse"
              aria-label={
                pulseBlockedReason
                  ? `Start Pulse unavailable: ${pulseBlockedReason}`
                  : 'Start Pulse'
              }
              title={pulseBlockedReason ?? 'Start Pulse'}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide transition-colors ${
                pulseBlockedReason
                  ? 'border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.08)] text-[rgba(196,131,42,0.75)] hover:bg-[rgba(196,131,42,0.16)]'
                  : 'border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.22)] text-[#E0A14A] hover:bg-[rgba(196,131,42,0.35)]'
              }`}
            >
              Start Pulse
            </button>
          ) : null}
          {onStartPulse && !pulseOn && pulseBlockedReason ? (
            <p
              className="basis-full text-[12px] leading-relaxed text-[var(--cream-muted)]"
              data-testid="empty-pulse-blocked"
            >
              {pulseBlockedReason}{' '}
              <Link
                to="/premium"
                className="font-bold text-[#C4832A] underline-offset-2 hover:underline"
              >
                MenRush+
              </Link>{' '}
              for unlimited pulses.
            </p>
          ) : null}
          {onOpenHotSpots ? (
            <button
              type="button"
              onClick={onOpenHotSpots}
              data-testid="empty-hot-spots"
              className="min-h-[44px] rounded-full border border-[rgba(196,131,42,0.5)] bg-transparent px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
            >
              Hot Spots
            </button>
          ) : null}
          {onFinishProfile ? (
            <button
              type="button"
              onClick={onFinishProfile}
              className="min-h-[44px] rounded-full border border-[rgba(196,131,42,0.5)] bg-transparent px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
            >
              Finish profile
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-[13px] text-[var(--cream-muted)]">
          Pulse gives you 90 minutes of priority visibility.
        </p>
        <p className="mt-2 text-[12px] font-medium tracking-wide text-[var(--text-secondary)]">
          Consent first · Report anytime
        </p>
      </div>
    );
  }

  // Phone: 2 cols. Tablet md+: denser auto-fill so iPad is not two giant squares.
  return (
    <div
      className={PROFILE_TILE_GRID_CLASS}
      data-testid="nearby-profile-grid"
    >
      {users.map((user) => {
        const meta = `${formatDistanceMiles(user)} · ${getTribeTag(user)} · ${formatActiveStatus(user)}`;
        const liked = likedUserIds?.has(user.id) ?? false;
        const mutual = mutualUserIds?.has(user.id) ?? false;
        const matching = matchingUserId === user.id;
        return (
          <div
            key={user.id}
            className="group relative overflow-hidden rounded-2xl border border-nn-border bg-nn-card text-left shadow-card transition-all hover:-translate-y-[3px] hover:border-[rgba(196,131,42,0.4)]"
            data-testid="nearby-grid-card"
          >
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(user)}
                className="block w-full text-left"
                aria-label={`Open profile for ${user.name}`}
                data-testid={`nearby-grid-photo-${user.id}`}
              >
                <GridCardFace user={user} meta={meta} />
              </button>
            ) : (
              <ProfilePhotoLink
                userId={user.id}
                name={user.name}
                className="block w-full text-left"
                data-testid={`nearby-grid-photo-${user.id}`}
              >
                <GridCardFace user={user} meta={meta} />
              </ProfilePhotoLink>
            )}
            {onMatch ? (
              <div className="border-t border-[var(--border-default)] p-1.5">
                <button
                  type="button"
                  disabled={matching}
                  data-testid={`grid-match-${user.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onMatch(user);
                  }}
                  className={`w-full rounded-xl py-2 text-[11px] font-extrabold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                    mutual
                      ? 'border border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.18)] text-[#E0A14A]'
                      : liked
                        ? 'border border-[rgba(196,131,42,0.5)] bg-transparent text-[#C4832A]'
                        : 'bg-[#C4832A] text-[#1A0E03] hover:bg-[#E0A14A]'
                  }`}
                >
                  {matching ? 'Sending…' : mutual ? 'Open chat' : liked ? 'Matched' : 'Match'}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function GridCardFace({ user, meta }: { user: NearbyUser; meta: string }) {
  return (
    <div className="relative aspect-square w-full bg-[var(--bg-elevated)]">
      <GridPhoto name={user.name} photoUrl={user.photo_url} age={user.age} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(13,10,6,0.94)] via-[rgba(13,10,6,0.55)] to-transparent px-2.5 pb-2 pt-10">
        <div className="flex items-center gap-1">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${user.online ? 'bg-[#4ADE80]' : 'bg-[#C4A882]'}`}
          />
          <span className="truncate text-[13px] font-bold text-[#FFF6E6] md:text-[12px] lg:text-[13px]">
            {user.name} {user.age}
          </span>
          {user.is_verified ? <VerifiedBadge size="sm" /> : null}
        </div>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--cream)]">{meta}</p>
        {user.looking_for ? (
          <p className="mt-0.5 truncate text-[10px] font-bold text-[#E0A14A]">{user.looking_for}</p>
        ) : null}
      </div>
    </div>
  );
}

function GridPhoto({
  name,
  age,
  photoUrl,
}: {
  name: string;
  photoUrl?: string;
  age?: number;
}) {
  // 480px display thumbs — iPhone Nearby was blank/slow on 4032×3024 originals.
  const { src, onError } = useResolvingPhotoSrc(photoUrl, age, { displayWidth: 480 });

  if (!src) {
    return (
      <div className="flex h-full items-center justify-center">
        <SilhouetteAvatar size={56} variant="card" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={onError}
    />
  );
}
