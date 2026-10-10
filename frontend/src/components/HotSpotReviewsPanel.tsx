/**
 * Reviews list + "Leave a review" form for one spot. Same hotSpotsAPI calls the
 * reviews modal used since Cruising Phase 2 (#283): listReviews, submitReview,
 * deleteReview. Shared by the spot sheet (Out card + map pin) and the reviews modal.
 * 15px minimum, 44px targets, theme tokens only.
 */
import { useEffect, useState } from 'react';
import type { HotSpotDTO, HotSpotReviewDTO } from '../api/client';
import { hotSpotsAPI } from '../api/client';
import { PulseRing } from './PulseRing';

interface HotSpotReviewsPanelProps {
  spot: HotSpotDTO;
  onSpotUpdated?: (updatedSpot: HotSpotDTO) => void;
}

export function HotSpotReviewsPanel({ spot, onSpotUpdated }: HotSpotReviewsPanelProps) {
  const [reviews, setReviews] = useState<HotSpotReviewDTO[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [body, setBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);

  const applyList = (data: { reviews?: HotSpotReviewDTO[]; rating_avg: number | null; review_count: number }) => {
    setReviews(data.reviews ?? []);
    setRatingAvg(data.rating_avg);
    setReviewCount(data.review_count);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setFormOpen(false);
    hotSpotsAPI
      .listReviews(spot.id)
      .then((res) => {
        if (!cancelled) applyList(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load reviews. Check your connection.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spot.id]);

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
      if (res.data.spot) onSpotUpdated?.(res.data.spot);
      const updated = await hotSpotsAPI.listReviews(spot.id);
      applyList(updated.data);
      setBody('');
      setFormOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId?: string) => {
    try {
      const res = await hotSpotsAPI.deleteReview(spot.id, reviewId);
      if (res.data.spot) onSpotUpdated?.(res.data.spot);
      const updated = await hotSpotsAPI.listReviews(spot.id);
      applyList(updated.data);
    } catch {
      setError('Could not delete that review. Try again.');
    }
  };

  return (
    <section aria-label="Reviews" data-testid="hotspot-reviews-panel" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[15px] text-[var(--cream-muted)]">
        <h3 className="text-[17px] font-extrabold text-[var(--cream)]">Reviews</h3>
        {ratingAvg != null ? (
          <span className="font-bold text-[var(--nn-accent-text)]">★ {ratingAvg}</span>
        ) : null}
        <span>
          · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-[15px] text-[var(--nn-danger-text)]">
          {error}
        </p>
      ) : null}

      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          data-testid="write-review-btn"
          className="min-h-[44px] w-full rounded-xl border border-[var(--copper)] bg-[var(--bg-card)] px-4 text-[15px] font-bold text-[var(--nn-accent-text)]"
        >
          Leave a review
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          data-testid="review-form"
          className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-[var(--cream)]">Rate this spot</span>
            <div className="flex items-center" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={star === selectedRating}
                  onClick={() => setSelectedRating(star)}
                  data-testid={`star-${star}`}
                  className={`flex h-11 w-11 items-center justify-center text-[22px] ${
                    star <= selectedRating ? 'text-[var(--nn-accent-text)]' : 'text-[var(--cream-muted)]'
                  }`}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  {star <= selectedRating ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="sr-only">Your review</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Atmosphere, time of day, parking, discreet tips"
              maxLength={500}
              rows={3}
              required
              data-testid="review-body-input"
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-[15px] text-[var(--cream)] placeholder-[var(--cream-muted)] focus:border-[var(--copper)] focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[15px] text-[var(--cream-muted)]">
            <span>Keep it honest and respectful. No names or harassment.</span>
            <span>{body.length}/500</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[15px] text-[var(--cream-soft)]">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                data-testid="review-anonymous-checkbox"
                className="h-5 w-5 accent-[var(--copper)]"
              />
              <span>Post anonymously</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="min-h-[44px] rounded-full px-4 text-[15px] font-semibold text-[var(--cream-muted)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                data-testid="submit-review-btn"
                className="min-h-[44px] rounded-full bg-[var(--copper)] px-5 text-[15px] font-bold text-[var(--nn-on-copper)]"
              >
                {submitting ? 'Posting…' : 'Post review'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <PulseRing size={28} label="Loading reviews" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-6 text-center" data-testid="reviews-empty">
          <p className="text-[15px] font-bold text-[var(--cream)]">No reviews yet</p>
          <p className="mt-1 text-[15px] text-[var(--cream-muted)]">
            Be the first to share an honest review of this spot.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5" data-testid="hotspot-reviews-list">
          {reviews.map((rev) => (
            <li
              key={rev.id}
              data-testid={`review-card-${rev.id}`}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[15px]">
                  <span className="font-bold text-[var(--nn-accent-text)]" aria-label={`${rev.rating} out of 5`}>
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </span>
                  <span className="font-semibold text-[var(--cream-soft)]">· {rev.author_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[15px] text-[var(--cream-muted)]">
                    {new Date(rev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  {rev.is_mine ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(rev.id)}
                      data-testid={`delete-review-${rev.id}`}
                      className="min-h-[44px] px-3 text-[15px] font-semibold text-[var(--nn-danger-text)]"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--cream)]">{rev.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
