import type { NearbyUser } from './ProfileCard';
import { SilhouetteAvatar } from './SilhouetteAvatar';
import { VerifiedBadge } from './VerifiedBadge';
import { getPhotoUrl } from './UserAvatar';
import { formatActiveStatus, formatDistanceMiles, getTribeTag } from '../lib/discoveryFormat';

interface NearbyProfileGridProps {
  users: NearbyUser[];
  loading: boolean;
  onSelect: (user: NearbyUser) => void;
}

export function NearbyProfileGrid({ users, loading, onSelect }: NearbyProfileGridProps) {
  if (loading && users.length === 0) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-[3/3.6] animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-default)] py-16 text-center text-[15px] text-[var(--cream-muted)]">
        No one nearby. Try a wider radius.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
      {users.map((user) => {
        const photo = getPhotoUrl(user.photo_url);
        const meta = `${formatDistanceMiles(user)} · ${getTribeTag(user)} · ${formatActiveStatus(user)}`;
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user)}
            className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-left shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:border-[var(--copper)]/40"
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
