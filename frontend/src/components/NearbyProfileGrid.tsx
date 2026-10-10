import type { NearbyUser } from './ProfileCard';
import { FadedBrandFace, isNearbyPlaceholderFace } from './FadedBrandFace';
import { DiscoveryPhotoFrame } from './DiscoveryPhotoFrame';
import { NewJoinerBadge } from './NewJoinerBadge';
import { ProfilePhotoLink } from './ProfilePhotoLink';
import { formatActiveStatus, getTribeTag } from '../lib/discoveryFormat';
import { getDistanceLabel, isUserOnlineNow, metaAfterDistance } from '../lib/discovery';
import { isFreshFaceNearby } from '../lib/newJoiner';
import {
  PROFILE_TILE_GRID_CLASS,
  PROFILE_TILE_SKELETON_CLASS,
} from '../lib/profileTileGrid';
import { useGridPhotoSrc, clearGridPhotoQueue } from '../lib/nearbyPhotoSrc';
import {
  matchCtaAriaLabel,
  matchCtaCompactToneClasses,
  matchCtaDisabled,
  matchCtaLabel,
  matchInterestState,
} from '../lib/matchCta';
import { IconMatches, IconChat } from './icons';
import { Link } from 'react-router-dom';
import { memo, useEffect, useRef } from 'react';

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
  /** When true, current search radius can still be expanded (i.e. below max/All). */
  canExpandRadius?: boolean;
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
  /** All (UK + Ireland) — hide Expand radius; it does nothing on this path. */
  hideExpandRadius?: boolean;
  /** When true, more pages can be loaded. */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * Nearby Grid — memo boundary so Discover GPS/header churn does not rebuild tiles.
 *
 * PERF next pass (phone, 40+ tiles): window with @tanstack/react-virtual or
 * CSS grid + IntersectionObserver mount; keep Brand empty face + Match CTA intact.
 */
export const NearbyProfileGrid = memo(function NearbyProfileGrid({
  users,
  loading,
  onSelect,
  onMatch,
  likedUserIds,
  mutualUserIds,
  matchingUserId,
  onExpandRadius,
  canExpandRadius = true,
  onFinishProfile,
  onStartPulse,
  pulseOn,
  pulseBlockedReason,
  onOpenHotSpots,
  radiusLabel,
  beyondRadiusCount = 0,
  hideExpandRadius = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: NearbyProfileGridProps) {
  useEffect(() => {
    clearGridPhotoQueue();
  }, []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          onLoadMoreRef.current?.();
        }
      },
      {
        rootMargin: '250px',
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingMore, Boolean(onLoadMore)]);

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
        <p className="text-[16px] font-extrabold text-[var(--cream)]">
          {hideExpandRadius ? 'No men in the UK and Ireland yet' : 'No men in this radius yet'}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[var(--cream-muted)]">
          {hideExpandRadius ? (
            <>Turn on location and finish your profile so others can find you.</>
          ) : beyondRadiusCount > 0 ? (
            <>
              <span className="font-bold text-[#E0A14A]">
                Men are farther out
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
          {onExpandRadius && !hideExpandRadius ? (
            <button
              type="button"
              onClick={onExpandRadius}
              data-testid="empty-expand-radius"
              className="min-h-[44px] rounded-full bg-[#C4832A] px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
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
              className={`min-h-[44px] rounded-full border px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide transition-colors ${
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
              className="basis-full text-[15px] leading-relaxed text-[var(--cream-muted)]"
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
              className="min-h-[44px] rounded-full border border-[rgba(196,131,42,0.5)] bg-transparent px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
            >
              Cruise
            </button>
          ) : null}
          {onFinishProfile ? (
            <button
              type="button"
              onClick={onFinishProfile}
              className="min-h-[44px] rounded-full border border-[rgba(196,131,42,0.5)] bg-transparent px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
            >
              Finish profile
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-[15px] text-[var(--cream-muted)]">
          Pulse gives you 90 minutes of priority visibility.
        </p>
        <p className="mt-2 text-[15px] font-medium tracking-wide text-[var(--text-secondary)]">
          Consent first · Report anytime
        </p>
      </div>
    );
  }

  // Phone: 3 cols (Brand lock). Tablet md+: denser auto-fill so iPad is not two giant squares.
  return (
    <>
      <div
        className={PROFILE_TILE_GRID_CLASS}
        data-testid="nearby-profile-grid"
      >
        {users.map((user) => (
          <NearbyGridCard
            key={user.id}
            user={user}
            liked={likedUserIds?.has(user.id) ?? false}
            mutual={mutualUserIds?.has(user.id) ?? false}
            matching={matchingUserId === user.id}
            onSelect={onSelect}
            onMatch={onMatch}
          />
        ))}
      </div>
      {hasMore && onLoadMore ? (
        <div
          className="mt-4 flex flex-col items-center justify-center py-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
          data-testid="nearby-load-more-container"
        >
          <div
            ref={sentinelRef}
            className="h-1 w-full"
            data-testid="nearby-grid-sentinel"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            data-testid="nearby-load-more"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--copper)]/60 bg-[var(--bg-elevated)]/90 px-6 py-2.5 text-[15px] font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-md transition-all hover:border-[var(--copper)] hover:bg-[var(--copper)]/20 active:scale-[0.98] disabled:opacity-50"
          >
            {loadingMore ? 'Loading more men…' : 'Load more men'}
          </button>
        </div>
      ) : null}
      {!hasMore && !loading && !loadingMore && users.length > 0 && canExpandRadius && !hideExpandRadius && onExpandRadius ? (
        <div
          className="mt-5 mb-2 flex flex-col items-center justify-center gap-1.5 px-4 py-3 text-center pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
          data-testid="nearby-widen-container"
        >
          <button
            type="button"
            onClick={onExpandRadius}
            data-testid="nearby-widen-search"
            title="Show men farther away"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--copper)]/60 bg-[var(--bg-elevated)]/90 px-6 py-2.5 text-[15px] font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-md transition-all hover:border-[var(--copper)] hover:bg-[var(--copper)]/20 active:scale-[0.98]"
          >
            End of this range · Widen search
          </button>
          <p className="text-[15px] font-medium text-[var(--cream-muted)]">
            Show men farther away
          </p>
        </div>
      ) : null}
    </>
  );
});

const NearbyGridCard = memo(function NearbyGridCard({
  user,
  liked,
  mutual,
  matching,
  onSelect,
  onMatch,
}: {
  user: NearbyUser;
  liked: boolean;
  mutual: boolean;
  matching: boolean;
  onSelect?: (user: NearbyUser) => void;
  onMatch?: (user: NearbyUser) => void | Promise<void>;
}) {
  // Distance shows once, in the meta line under the name (no corner chip).
  // When distance is missing, getDistanceLabel returns "Nearby"; skip a second
  // "Nearby" from the tribe fallback so Soft QC never sees "Nearby · Nearby".
  const distLabel = getDistanceLabel(user);
  const metaRest = metaAfterDistance(distLabel, [getTribeTag(user), formatActiveStatus(user)]);
  const matchState = matchInterestState({ liked, mutual });
  const matchDisabled = matchCtaDisabled(matchState, matching);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-nn-border bg-nn-card text-left shadow-card transition-all hover:-translate-y-[3px] hover:border-[rgba(196,131,42,0.4)] md:rounded-2xl [content-visibility:auto] [contain-intrinsic-size:auto_220px]"
      data-testid="nearby-grid-card"
    >
      <div className="relative">
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(user)}
            className="block w-full text-left"
            aria-label={`Open profile for ${user.name}`}
            data-testid={`nearby-grid-photo-${user.id}`}
          >
            <GridCardFace user={user} distLabel={distLabel} metaRest={metaRest} />
          </button>
        ) : (
          <ProfilePhotoLink
            userId={user.id}
            name={user.name}
            className="block w-full text-left"
            data-testid={`nearby-grid-photo-${user.id}`}
          >
            <GridCardFace user={user} distLabel={distLabel} metaRest={metaRest} />
          </ProfilePhotoLink>
        )}
        {false && isFreshFaceNearby(user) ? (
          <NewJoinerBadge />
        ) : null}
      </div>
      {onMatch ? (
        <div className="border-t border-[var(--border-default)] p-1 md:p-1.5">
          <button
            type="button"
            disabled={matchDisabled}
            aria-disabled={matchDisabled}
            aria-label={matchCtaAriaLabel(matchState, user.name, {
              mutualOpensChat: true,
            })}
            title={matching ? 'Sending…' : matchState === 'mutual' ? 'Chat' : matchState === 'outgoing' ? 'Sent' : 'Match'}
            data-testid={`grid-match-${user.id}`}
            onClick={(e) => {
              e.stopPropagation();
              if (matchDisabled) return;
              void onMatch(user);
            }}
            className={`w-full rounded-lg py-1.5 text-[15px] font-extrabold tracking-wide transition-colors flex items-center justify-center gap-1.5 md:rounded-xl md:py-2 md:text-[15px] ${
              matchState === 'none' || matching ? 'uppercase' : ''
            } ${matchCtaCompactToneClasses(matchState)}`}
          >
            {matchState === 'mutual' ? <IconChat size={14} /> : <IconMatches size={14} />}
            <span>
              {matchCtaLabel(matchState, user.name, {
                sending: matching,
                mutualLabel: 'chat',
              })}
            </span>
          </button>
        </div>
      ) : null}

    </div>
  );
});

const GridCardFace = memo(function GridCardFace({
  user,
  distLabel,
  metaRest,
}: {
  user: NearbyUser;
  distLabel: string;
  metaRest: string;
}) {
  const online = isUserOnlineNow(user);

  return (
    <DiscoveryPhotoFrame
      online={online}
      verified={!!user.is_verified}
      className="relative aspect-square w-full bg-[var(--bg-elevated)]"
    >
      <GridPhoto name={user.name} photoUrl={user.photo_url} age={user.age} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(13,10,6,0.94)] via-[rgba(13,10,6,0.55)] to-transparent px-1.5 pb-1.5 pt-8 md:px-2.5 md:pb-2 md:pt-10">
        <div className="flex items-center gap-0.5 md:gap-1">
          <span className="min-w-0 break-words text-[15px] font-bold leading-tight text-[#FFF6E6] [overflow-wrap:anywhere] line-clamp-2" data-testid={`nearby-grid-name-${user.id}`}>
            {user.name}{typeof user.age === 'number' ? ` ${user.age}` : ''}
          </span>

        </div>
        <p className="mt-0.5 text-[15px] font-semibold leading-tight text-[var(--cream)] [overflow-wrap:anywhere] line-clamp-2" data-testid={`nearby-grid-meta-${user.id}`}>
          <span data-testid={`nearby-grid-distance-${user.id}`}>{distLabel}</span>
          {metaRest ? ` · ${metaRest}` : ''}
        </p>
        {user.looking_for ? (
          <p className="mt-0.5 text-[15px] font-bold leading-tight text-[#E0A14A] [overflow-wrap:anywhere] line-clamp-2" data-testid={`nearby-grid-tag-${user.id}`}>{user.looking_for}</p>
        ) : null}
      </div>
    </DiscoveryPhotoFrame>
  );
});

function GridPhoto({
  name,
  age,
  photoUrl,
}: {
  name: string;
  photoUrl?: string;
  age?: number;
}) {
  // Phone path: display API when live, else fetch+downscale — never leave blank tiles.
  const { src, phase } = useGridPhotoSrc(photoUrl, age);
  const trimmed = photoUrl?.trim() || '';

  // Real /uploads still loading — elevated pending tile (not Brand empty cutout).
  if (phase === 'loading' && trimmed.startsWith('/uploads/')) {
    return (
      <div
        className="h-full w-full bg-[var(--bg-elevated)]"
        data-testid="nearby-photo-pending"
        data-photo-phase={phase}
        aria-hidden
      />
    );
  }

  // Empty / missing / generic avatar slots → faded official medallion (Brand).
  // Real /uploads photos keep their bytes (media lock).
  if (isNearbyPlaceholderFace(photoUrl, phase) || !src) {
    return (
      <div className="h-full w-full" data-testid="nearby-photo-placeholder">
        <FadedBrandFace variant="tile" label={name} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className="h-full w-full object-cover"
      decoding="async"
      data-testid="nearby-profile-photo"
      data-photo-phase={phase}
    />
  );
}
