import { useEffect, useState } from 'react';
import { ProfileDrawer } from '../components/ProfileDrawer';
import type { NearbyUser } from '../components/ProfileCard';
import { applyTheme } from '../lib/theme';

/**
 * DEV-only visual harness for the Nearby grid → profile sheet (ProfileDrawer).
 * Reproduces the owner-phone layout case (Graham / silhouette / distance pill).
 * Route: /dev/profile-sheet
 */
const GRAHAM: NearbyUser = {
  id: 'graham-preview',
  name: 'Graham',
  age: 46,
  headline: 'Scottish Bear',
  looking_for: 'Casual',
  interests: ['Top', 'Bear', 'Cub', 'Stocky', 'Hairy', 'White'],
  online: false,
  distance_km: 45,
  distance_label: '28 mi',
};

export function ProfileDrawerPreview() {
  const [open, setOpen] = useState(true);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    applyTheme('dark');
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-primary)', color: 'var(--cream)' }}
      data-testid="profile-sheet-preview"
    >
      <div className="border-b border-[var(--border-default)] px-4 py-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#C4832A]">
          Profile sheet preview
        </p>
        <p className="mt-1 text-[12px] text-[var(--cream-muted)]">
          Nearby grid → pull-up sheet. Avatar must be fully visible; distance not on the face.
        </p>
        <button
          type="button"
          className="mt-3 rounded-full border border-[rgba(196,131,42,0.35)] px-3 py-1.5 text-[12px] font-semibold"
          onClick={() => setOpen(true)}
          data-testid="profile-sheet-preview-open"
        >
          Open sheet
        </button>
      </div>
      <div className="px-4 py-8 text-[13px] text-[var(--cream-muted)]">
        Simulated Nearby grid behind the sheet (phone widths).
      </div>
      {open ? (
        <ProfileDrawer
          user={GRAHAM}
          liked={liked}
          onClose={() => setOpen(false)}
          onLike={() => setLiked(true)}
          onPass={() => setOpen(false)}
          onMessage={() => undefined}
        />
      ) : null}
    </div>
  );
}
