import { Link } from 'react-router-dom';
import type { HotSpotDTO } from '../api/client';
import { IconClose } from './icons';
import { formatDistanceFromKm } from '../lib/localeUnits';
import { HOT_SPOTS_CONSENT, HOT_SPOTS_FACE } from '../lib/cruiseCopy';

interface HotSpotSheetProps {
  spot: HotSpotDTO | null;
  isPremium: boolean;
  acting: boolean;
  error: string;
  onClose: () => void;
  onCheckIn: (spot: HotSpotDTO, anonymous: boolean) => void | Promise<void>;
}

/**
 * In-map Cruise details + check-in/out. Selecting a Cruise pin on Nearby opens
 * details and check-in without navigating away. Active/check-in counts only when real.
 */
export function HotSpotSheet({ spot, isPremium, acting, error, onClose, onCheckIn }: HotSpotSheetProps) {
  if (!spot) return null;

  const active = Boolean(spot.has_active_checkins ?? spot.live_count_exact > 0);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={spot.name}
      data-testid="hotspot-sheet"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-lg)] lg:rounded-3xl lg:mb-0 mb-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-testid="hotspot-sheet-close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--cream-muted)] hover:text-[var(--cream)]"
        >
          <IconClose size={18} />
        </button>

        <p className="pr-10 text-xs font-extrabold tracking-wide text-[#E0A14A]">
          {spot.category_icon} {spot.category_name}
        </p>
        <h2 className="text-lg font-bold text-[var(--cream)]">{spot.name}</h2>
        <p className="mt-0.5 text-[13px] text-[var(--cream-muted)]">
          {spot.city ?? 'UK'}
          {spot.nation ? ` · ${spot.nation}` : ''}
          {spot.distance_km != null ? ` · ${formatDistanceFromKm(Number(spot.distance_km))}` : ''}
        </p>

        <p
          className="mt-2 text-[11px] leading-relaxed text-[var(--cream-muted)]"
          data-testid="hotspot-sheet-brand-face"
        >
          {HOT_SPOTS_FACE}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-[var(--cream-muted)]" data-testid="hotspot-sheet-consent">
          {HOT_SPOTS_CONSENT}
        </p>

        {spot.description ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--cream-muted)]">{spot.description}</p>
        ) : null}

        {spot.source_url ? (
          <a
            href={spot.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[12px] font-semibold text-[#C4832A] hover:text-[#E0A14A]"
          >
            Venue website
          </a>
        ) : null}

        <div className="mt-3 flex items-center gap-2" data-testid="hotspot-sheet-activity">
          <span
            className="inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: active ? '#3D7A2E' : 'rgba(240,224,192,0.35)' }}
          />
          <p className="text-[13px] font-bold text-[var(--cream)]">
            {active ? `${spot.live_count} checked in` : 'No check-ins right now'}
          </p>
        </div>
        <p className="mt-1 text-[11px] text-[var(--cream-muted)]">
          Check-ins expire after {spot.checkin_ttl_hours ?? 4} hours.
        </p>

        {error ? <p className="mt-3 text-[13px] font-semibold text-[#D96A52]">{error}</p> : null}

        <div className="mt-4 flex flex-col gap-2">
          {spot.is_checked_in ? (
            <button
              type="button"
              disabled={acting}
              onClick={() => void onCheckIn(spot, false)}
              data-testid="hotspot-sheet-checkout"
              className="rounded-full border border-[var(--copper)]/50 py-2.5 text-[13px] font-bold text-[#E0A14A]"
            >
              {acting ? 'Updating…' : 'Check out'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={acting}
                onClick={() => void onCheckIn(spot, false)}
                data-testid="hotspot-sheet-checkin"
                className="mr-cta-gradient rounded-full py-2.5 text-[13px] font-bold"
              >
                {acting ? 'Checking in…' : 'Check in'}
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void onCheckIn(spot, true)}
                data-testid="hotspot-sheet-checkin-anon"
                className="rounded-full border border-[var(--border-default)] py-2 text-[12px] font-semibold text-[var(--cream-muted)] hover:border-[var(--copper)]/40"
              >
                Check in anonymously
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--cream-muted)]">
          <Link to="/safety" className="font-semibold text-[#C4832A] hover:text-[#E0A14A]">
            Safety tips
          </Link>
          {!isPremium ? <span>Counts of 5+ are rounded on Free.</span> : null}
        </div>
      </div>
    </div>
  );
}
