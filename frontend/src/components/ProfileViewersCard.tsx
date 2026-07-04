import { Link } from 'react-router-dom';
import { UserAvatar } from './UserAvatar';

export interface ProfileViewer {
  id: string;
  name: string;
  age: number;
  photo_url?: string | null;
  online?: boolean;
  viewed_at: string;
}

interface ProfileViewersCardProps {
  viewers: ProfileViewer[];
  total: number;
  isPremium: boolean;
  hasMore: boolean;
  hiddenCount: number;
  loading?: boolean;
}

function formatViewedAt(iso: string): string {
  const viewed = new Date(iso).getTime();
  const diffMs = Date.now() - viewed;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ProfileViewersCard({
  viewers,
  total,
  isPremium,
  hasMore,
  hiddenCount,
  loading = false,
}: ProfileViewersCardProps) {
  return (
    <div
      className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-5 shadow-card"
      data-testid="profile-viewers-card"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#F0E0C0]">Who viewed you</p>
          <p className="mt-0.5 text-xs text-[#A89070]">
            {isPremium
              ? 'Full viewer history'
              : `Last ${Math.min(5, total || 5)} viewers · Premium unlocks all`}
          </p>
        </div>
        {total > 0 && (
          <span className="rounded-full border border-[#C4832A]/35 bg-[#C4832A]/10 px-2.5 py-1 text-[11px] font-bold text-[#C4832A]">
            {total}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-[#3D2B0E]/40" />
          ))}
        </div>
      ) : viewers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#3D2B0E] px-4 py-6 text-center text-sm text-[#A89070]">
          No profile views yet. Stay visible on the map and Pulse when you&apos;re out.
        </p>
      ) : (
        <ul className="space-y-2">
          {viewers.map((viewer) => (
            <li key={viewer.id}>
              <Link
                to={`/profile/${viewer.id}`}
                className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-[#3D2B0E] hover:bg-[#3D2B0E]/35"
              >
                <UserAvatar
                  name={viewer.name}
                  photoUrl={viewer.photo_url ?? undefined}
                  online={viewer.online}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#F0E0C0]">
                    {viewer.name}
                    <span className="font-normal text-[#A89070]"> · {viewer.age}</span>
                  </p>
                  <p className="text-[11px] text-[#A89070]">Viewed {formatViewedAt(viewer.viewed_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore && hiddenCount > 0 && (
        <div className="mt-4 rounded-xl border border-[#C4832A]/25 bg-[#C4832A]/8 px-4 py-3 text-center">
          <p className="text-xs text-[#F0E0C0]/85">
            <span className="font-bold text-[#C4832A]">{hiddenCount} more</span> men viewed your profile.
          </p>
          <Link
            to="/premium"
            className="mt-2 inline-flex text-xs font-bold uppercase tracking-wide text-[#C4832A] hover:underline"
          >
            Unlock full history →
          </Link>
        </div>
      )}
    </div>
  );
}
