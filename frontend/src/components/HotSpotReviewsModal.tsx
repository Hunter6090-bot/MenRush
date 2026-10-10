import type { HotSpotDTO } from '../api/client';
import { IconClose } from './icons';
import { HotSpotReviewsPanel } from './HotSpotReviewsPanel';

interface HotSpotReviewsModalProps {
  spot: HotSpotDTO | null;
  open: boolean;
  onClose: () => void;
  onSpotUpdated?: (updatedSpot: HotSpotDTO) => void;
}

/** Full-page reviews modal (HotSpots page). Body is the shared HotSpotReviewsPanel. */
export function HotSpotReviewsModal({ spot, open, onClose, onSpotUpdated }: HotSpotReviewsModalProps) {
  if (!open || !spot) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reviews for ${spot.name}`}
      data-testid="hotspot-reviews-modal"
      className="fixed inset-0 z-[75] flex items-end justify-center lg:items-center"
    >
      <button
        type="button"
        aria-label="Close reviews"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      <div className="relative flex h-[80vh] max-h-[640px] w-full max-w-lg flex-col rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl lg:h-[75vh] lg:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-5 py-2">
          <h2 className="text-[17px] font-extrabold leading-snug text-[var(--cream)]">{spot.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="hotspot-reviews-close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--cream-muted)] hover:text-[var(--cream)]"
          >
            <IconClose size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:px-6">
          <HotSpotReviewsPanel spot={spot} onSpotUpdated={onSpotUpdated} />
        </div>
        <div className="shrink-0 border-t border-[var(--border-default)] px-5 py-2.5 text-center text-[15px] text-[var(--cream-muted)]">
          Consenting adults only (18+). Honest community feedback.
        </div>
      </div>
    </div>
  );
}
