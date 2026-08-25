import { FormEvent, useCallback, useEffect, useState } from 'react';
import { communityAPI, type CommunityPostDTO } from '../api/client';
import { PulseRing } from './PulseRing';

const MAX_CHARS = 280;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface CommunityFeedProps {
  lat: number | null;
  lng: number | null;
  compact?: boolean;
  onNeedLocation?: () => void;
}

export function CommunityFeed({ lat, lng, compact = false, onNeedLocation }: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityPostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (lat == null || lng == null) {
      setLoading(false);
      return;
    }
    try {
      const res = await communityAPI.list(lat, lng);
      setPosts(res.data.posts ?? []);
      setError('');
    } catch {
      setError('Could not load community posts.');
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || body.length > MAX_CHARS) return;
    if (lat == null || lng == null) {
      onNeedLocation?.();
      setError('We need your location to post locally.');
      return;
    }
    setPosting(true);
    try {
      const res = await communityAPI.create(body, lat, lng);
      setPosts((prev) => [res.data.post, ...prev]);
      setDraft('');
      setError('');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not post right now.';
      setError(message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className={compact ? 'space-y-3 px-1' : 'space-y-4'} data-testid="community-feed">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">Community</p>
        <p className="mt-0.5 text-sm text-[var(--cream-muted)]">
          Short local posts. Text only — Rooms stay the video space.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3"
        data-testid="community-compose"
      >
        <label className="sr-only" htmlFor="community-post-body">
          Community post
        </label>
        <textarea
          id="community-post-body"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
          maxLength={MAX_CHARS}
          rows={compact ? 2 : 3}
          placeholder="What’s happening nearby?"
          className="w-full resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--cream)] placeholder:text-[var(--cream-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--copper)]/50"
          data-testid="community-compose-input"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className="text-[11px] tabular-nums text-[var(--cream-muted)]"
            data-testid="community-char-count"
          >
            {draft.length}/{MAX_CHARS}
          </span>
          <button
            type="submit"
            disabled={posting || draft.trim().length === 0}
            className="rounded-full bg-[#C4832A] px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] disabled:opacity-50"
            data-testid="community-post-submit"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded-xl border border-[#A45E18]/40 bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--cream)]">
          {error}
        </p>
      ) : null}

      {lat == null || lng == null ? (
        <div
          className="rounded-2xl border border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.08)] px-5 py-8 text-center"
          data-testid="community-location-gate"
        >
          <p className="text-[15px] font-extrabold text-[var(--cream)]">Location needed for the local feed</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[var(--cream-muted)]">
            Posts show approximate distance only — never an exact pin.
          </p>
          {onNeedLocation ? (
            <button
              type="button"
              onClick={onNeedLocation}
              className="mt-4 rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03]"
            >
              Allow location
            </button>
          ) : null}
        </div>
      ) : loading ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <PulseRing size={28} label="Loading community" />
        </div>
      ) : posts.length === 0 ? (
        <div
          className="rounded-2xl border border-[rgba(196,131,42,0.3)] bg-[rgba(196,131,42,0.06)] px-5 py-8 text-center"
          data-testid="community-empty"
        >
          <p className="text-[15px] font-extrabold text-[var(--cream)]">No posts nearby yet</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--cream-muted)]">
            Be the first to drop a short local note. No photos or video here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5" data-testid="community-post-list">
          {posts.map((post) => (
            <li
              key={post.id}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-3"
              data-testid={`community-post-${post.id}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-bold text-[var(--cream)]">{post.author_name}</p>
                <p className="shrink-0 text-[11px] text-[var(--cream-muted)]">{timeAgo(post.created_at)}</p>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--cream)]">
                {post.body}
              </p>
              <p className="mt-2 text-[11px] font-semibold text-[#C4832A]">{post.distance_label}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
