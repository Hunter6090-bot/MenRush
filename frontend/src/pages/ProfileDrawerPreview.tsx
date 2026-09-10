import { useEffect, useState } from 'react';
import { ProfileDrawer } from '../components/ProfileDrawer';
import type { NearbyUser } from '../components/ProfileCard';
import { applyTheme } from '../lib/theme';

/**
 * DEV-only visual harness for the Nearby grid → profile sheet (ProfileDrawer).
 * Reproduces match CTA states + tap-to-enlarge for avatar/cover.
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
  photo_url: '/images/menrush/30-bear-portrait-night.jpeg',
  cover_url: '/images/menrush/31-london-rooftop-dusk.jpeg',
};

type MatchDemo = 'none' | 'outgoing' | 'mutual';

export function ProfileDrawerPreview() {
  const [open, setOpen] = useState(true);
  const [matchDemo, setMatchDemo] = useState<MatchDemo>('none');

  useEffect(() => {
    applyTheme('dark');
  }, []);

  const liked = matchDemo === 'outgoing' || matchDemo === 'mutual';
  const mutual = matchDemo === 'mutual';

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
          Match CTA: idle / one-way pending / mutual. Tap avatar or cover to enlarge.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-[rgba(196,131,42,0.35)] px-3 py-1.5 text-[12px] font-semibold"
            onClick={() => setOpen(true)}
            data-testid="profile-sheet-preview-open"
          >
            Open sheet
          </button>
          {(
            [
              ['none', 'Idle Match'],
              ['outgoing', 'One-way pending'],
              ['mutual', 'Mutual'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-testid={`profile-sheet-demo-${key}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                matchDemo === key
                  ? 'border-[var(--copper)] bg-[rgba(196,131,42,0.18)] text-[var(--copper)]'
                  : 'border-[var(--border-default)] text-[var(--cream-muted)]'
              }`}
              onClick={() => {
                setMatchDemo(key);
                setOpen(true);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-8 text-[13px] text-[var(--cream-muted)]">
        Simulated Nearby grid behind the sheet (phone widths).
      </div>
      {open ? (
        <ProfileDrawer
          user={GRAHAM}
          liked={liked}
          mutual={mutual}
          onClose={() => setOpen(false)}
          onLike={() => setMatchDemo('outgoing')}
          onPass={() => setOpen(false)}
          onMessage={() => undefined}
        />
      ) : null}
    </div>
  );
}
