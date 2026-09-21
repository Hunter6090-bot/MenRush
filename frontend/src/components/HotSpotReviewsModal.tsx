import { useEffect, useState } from 'react';
import type { HotSpotDTO, HotSpotReviewDTO } from '../api/client';
import { hotSpotsAPI } from '../api/client';
import { IconClose } from './icons';
import { PulseRing } from './PulseRing';

interface HotSpotReviewsModalProps {
  spot: HotSpotDTO | null;
  open: boolean;
  onClose: () => void;
  onSpotUpdated?: (updatedSpot: HotSpotDTO) => void;
}

export function HotSpotReviewsModal({
  spot,
  open,
  onClose,
  onSpotUpdated,
}: HotSpotReviewsModalProps) {
  const [reviews, setReviews] = useState<HotSpotReviewDTO[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // Form state
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [body, setBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);

  useEffect(() => {
    if (!open || !spot) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    hotSpotsAPI
      .listReviews(spot.id)
      .then((res) => {
        if (!cancelled) {
          setReviews(res.data.reviews ?? []);
          setRatingAvg(res.data.rating_avg);
          setReviewCount(res.data.review_count);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[hotspot-reviews] failed to load', err);
          setError('Could not load reviews. Check your connection.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, spot?.id]);

  if (!open || !spot) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError('Please enter your review text.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await hotSpotsAPI.submitReview(spot.id, selectedRating, body.trim(), isAnonymous);
      if (res.data.spot) {
        onSpotUpdated?.(res.data.spot);
      }
      // Re-fetch reviews to show the new or updated review
      const updatedList = await hotSpotsAPI.listReviews(spot.id);
      setReviews(updatedList.data.reviews ?? []);
      setRatingAvg(updatedList.data.rating_avg);
      setReviewCount(updatedList.data.review_count);
      setBody('');
      setFormOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to submit review.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId?: string) => {
    try {
      const res = await hotSpotsAPI.deleteReview(spot.id, reviewId);
      if (res.data.spot) {
        onSpotUpdated?.(res.data.spot);
      }
      const updatedList = await hotSpotsAPI.listReviews(spot.id);
      setReviews(updatedList.data.reviews ?? []);
      setRatingAvg(updatedList.data.rating_avg);
      setReviewCount(updatedList.data.review_count);
    } catch (err) {
      console.error('[hotspot-reviews] delete error', err);
    }
  };

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

      <div className="relative flex h-[80vh] max-h-[640px] w-full max-w-lg flex-col rounded-t-3xl border border-[#3D2B0E] bg-[#0D0A06] text-[#F0E0C0] shadow-2xl lg:h-[75vh] lg:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#3D2B0E] px-5 py-3.5">
          <div>
            <h2 className="text-base font-extrabold text-[#F0E0C0] leading-snug">
              {spot.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#F0E0C0]/80 mt-0.5">
              <span>Reviews</span>
              {ratingAvg != null ? (
                <span className="font-bold text-[#E0A14A]">★ {ratingAvg}</span>
              ) : null}
              <span>· {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="hotspot-reviews-close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#F0E0C0]/70 hover:text-[#F0E0C0]"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 sm:px-6 overscroll-contain">
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </div>
          ) : null}

          {/* Add Review Accordion/Toggle */}
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              data-testid="write-review-btn"
              className="w-full rounded-xl border border-[var(--copper)]/40 bg-[#C4832A]/10 py-2.5 text-xs font-bold text-[#E0A14A] transition-colors hover:bg-[#C4832A]/20"
            >
              Write a review (1–5 ★)
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              data-testid="review-form"
              className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F0E0C0]">Rate this spot</span>
                {/* 1-5 Star Picker */}
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      data-testid={`star-${star}`}
                      className={`text-lg transition-transform hover:scale-110 ${
                        star <= selectedRating ? 'text-[#E0A14A]' : 'text-[rgba(240,224,192,0.25)]'
                      }`}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Atmosphere, time of day, parking, discreet tips…"
                  maxLength={500}
                  rows={3}
                  required
                  data-testid="review-body-input"
                  className="w-full rounded-xl border border-[#3D2B0E] bg-[#0D0A06] p-2.5 text-xs text-[#F0E0C0] placeholder-[#D4C4A8]/70 focus:border-[#C4832A] focus:outline-none focus:ring-1 focus:ring-[#C4832A]"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] text-[#F0E0C0]/70">
                  <span>Keep it honest & respectful. No names or harassment.</span>
                  <span>{body.length}/500</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-xs text-[#F0E0C0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    data-testid="review-anonymous-checkbox"
                    className="rounded border-[#3D2B0E] bg-[#0D0A06] text-[#C4832A] focus:ring-0"
                  />
                  <span>Post anonymously</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="rounded-full px-3 py-1.5 text-xs text-[#F0E0C0]/70 hover:text-[#F0E0C0]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="submit-review-btn"
                    className="mr-cta-gradient rounded-full px-4 py-1.5 text-xs font-bold"
                  >
                    {submitting ? 'Submitting…' : 'Post review'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Reviews List */}
          {loading ? (
            <div className="flex justify-center py-10">
              <PulseRing size={28} label="Loading reviews" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-12 text-center" data-testid="reviews-empty">
              <span className="text-2xl" aria-hidden="true">★</span>
              <p className="mt-2 text-xs font-bold text-[#F0E0C0]">No reviews yet</p>
              <p className="mt-0.5 text-[11px] text-[#F0E0C0]/70">
                Be the first to share an honest review of this spot.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  data-testid={`review-card-${rev.id}`}
                  className="rounded-xl border border-[#3D2B0E] bg-[#1E1508] p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#E0A14A]">
                        {'★'.repeat(rev.rating)}
                        <span className="text-[rgba(240,224,192,0.2)]">{'★'.repeat(5 - rev.rating)}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-[#F0E0C0]">
                        · {rev.author_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#F0E0C0]/70">
                        {new Date(rev.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {rev.is_mine ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(rev.id)}
                          data-testid={`delete-review-${rev.id}`}
                          className="text-[10px] font-medium text-red-400/80 hover:text-red-400"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#F0E0C0] whitespace-pre-wrap">
                    {rev.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#3D2B0E] bg-[#0D0A06]/95 px-5 py-2.5 text-center text-[10px] text-[#F0E0C0]/70">
          <span>Consenting adults only (18+). Honest community feedback.</span>
        </div>
      </div>
    </div>
  );
}
