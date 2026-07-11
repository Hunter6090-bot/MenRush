import type { NearbyUser } from './ProfileCard';
import { SilhouetteAvatar } from './SilhouetteAvatar';
import { VerifiedBadge } from './VerifiedBadge';
import { getPhotoUrl } from './UserAvatar';
import { formatActiveStatus, formatDistanceMiles, getTribeTag } from '../lib/discoveryFormat';

interface NearbyProfileGridProps {
  users: NearbyUser[];
  loading: boolean;
  onSelect: (user: NearbyUser) => void;
  /** Expand search radius — cold-start density for beta. */
  onExpandRadius?: () => void;
  /** Jump to profile setup when location/avatar incomplete. */
  onFinishProfile?: () => void;
  radiusLabel?: string;
}

export function NearbyProfileGrid({
  users,
  loading,
  onSelect,
  onExpandRadius,
  onFinishProfile,
  radiusLabel,
}: NearbyProfileGridProps) {
  if (loading && users.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-[3/3.6] animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]" />
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
          Beta is still filling in. Expand your range
          {radiusLabel ? ` (now ${radiusLabel})` : ''}, turn on location, and finish your profile so
          others can find you.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onExpandRadius ? (
            <button
              type="button"
              onClick={onExpandRadius}
              className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Expand radius
            </button>
          ) : null}
          {onFinishProfile ? (
            <button
              type="button"
              onClick={onFinishProfile}
              className="rounded-full border border-[rgba(196,131,42,0.5)] bg-transparent px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
            >
              Finish profile
            </button>
          ) : null}
        </div>
        <p className="mt-4 text-[11px] font-medium tracking-wide text-[#A89070]">
          18+ only · Consent first · Report anytime
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] lg:gap-3.5">
      {users.map((user) => {
        const photo = getPhotoUrl(user.photo_url);
        const meta = `${formatDistanceMiles(user)} · ${getTribeTag(user)} · ${formatActiveStatus(user)}`;
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user)}
            className="group relative overflow-hidden rounded-2xl border border-nn-border bg-nn-card text-left shadow-card transition-all hover:-translate-y-[3px] hover:border-[rgba(196,131,42,0.4)]"
          >
            <div className="relative aspect-[3/3.6] w-full bg-[var(--bg-elevated)]">
              {photo ? (
                <img src={photo} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <SilhouetteAvatar size={80} variant="card" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(13,10,6,0.92)] to-transparent px-3 pb-2.5 pt-10">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${user.online ? 'bg-[var(--status-online)]' : 'bg-[var(--cream-muted)]'}`}
                  />
                  <span className="truncate text-[15px] font-bold text-[var(--cream)]">
                    {user.name} {user.age}
                  </span>
                  {user.is_verified ? <VerifiedBadge size="sm" /> : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--cream-muted)]">{meta}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
