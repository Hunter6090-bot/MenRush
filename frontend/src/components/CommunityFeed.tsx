import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  communityAPI,
  type CommunityPostDTO,
  usersAPI,
} from '../api/client';
import { formatDistanceFromKm } from '../lib/localeUnits';
import { formatRelativeTime } from '../lib/notifications';
import { ROUTE_LABELS } from '../lib/routeLabels';
import { useAuthStore } from '../hooks/store';
import { MentionTextarea } from './MentionTextarea';
import { CommunityPostComments } from './CommunityPostComments';
import { PulseRing } from './PulseRing';
import { FadedBrandFace, isNearbyPlaceholderFace } from './FadedBrandFace';
import { useResolvingPhotoSrc } from './UserAvatar';

const MAX_CHARS = 280;

type CommunityFeedProps = {
  /** Optional fixed radius (km). Defaults to 10. */
  radiusKm?: number;
  /** Compact layout (fewer composer rows). */
  compact?: boolean;
  className?: string;
};

function PostAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const { src, onError } = useResolvingPhotoSrc(photoUrl);
  if (src && !isNearbyPlaceholderFace(photoUrl)) {
    return (
      <img
        src={src}
        alt=""
        onError={onError}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[rgba(196,131,42,0.35)]"
      />
    );
  }
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-[rgba(196,131,42,0.35)]">
      <FadedBrandFace variant="profile" size={40} label={name} />
    </div>
  );
}

function distanceDisplay(post: CommunityPostDTO): string {
  const km = Number(post.distance_km);
  if (Number.isFinite(km)) return formatDistanceFromKm(km);
  return post.distance_label || 'Nearby';
}

/**
 * Community Space — short local text posts only.
 * Free for all; no video, rooms, or premium lock.
 */
export function CommunityFeed({
  radiusKm = 10,
  compact = false,
  className = '',
}: CommunityFeedProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [posts, setPosts] = useState<CommunityPostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLocation, setNeedsLocation] = useState(false);
  const [viewerLat, setViewerLat] = useState<number | null>(null);
  const [viewerLng, setViewerLng] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  // Editing state for posts
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Deleting state for posts
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);

  const startEditPost = (post: CommunityPostDTO) => {
    setEditingPostId(post.id);
    setEditDraft(post.body);
    setEditError('');
    setDeleteConfirmPostId(null);
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditDraft('');
    setEditError('');
  };

  const handleSaveEditPost = async (postId: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed.length > MAX_CHARS || savingEdit) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const res = await communityAPI.updatePost(postId, trimmed);
      const updated = res.data.post;
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      setEditingPostId(null);
      setEditDraft('');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setEditError(ax.response?.data?.error || 'Could not update post.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    try {
      await communityAPI.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setDeleteConfirmPostId(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      alert(ax.response?.data?.error || 'Could not delete post.');
    } finally {
      setDeletingPostId(null);
    }
  };

  const loadFeed = useCallback(
    async (lat: number, lng: number) => {
      const res = await communityAPI.listPosts(lat, lng, radiusKm);
      setPosts(res.data.posts ?? []);
      setError('');
      setNeedsLocation(false);
      setViewerLat(lat);
      setViewerLng(lng);
    },
    [radiusKm],
  );

  const resolveLocationAndLoad = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Prefer saved pin first so the feed appears quickly.
      try {
        const me = await usersAPI.getMe();
        const lat = me.data?.lat != null ? Number(me.data.lat) : NaN;
        const lng = me.data?.lng != null ? Number(me.data.lng) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          await loadFeed(lat, lng);
          setLoading(false);
        }
      } catch {
        /* continue to live GPS */
      }

      const { requestDeviceLocation } = await import('../lib/deviceLocation');
      const result = await requestDeviceLocation();
      if (result.ok) {
        await usersAPI.updateLocation(result.lat, result.lng).catch(() => {});
        await loadFeed(result.lat, result.lng);
        setLoading(false);
        return;
      }

      setLoading(false);
      setPosts((prev) => {
        if (prev.length === 0) {
          setNeedsLocation(true);
          setError(result.message);
        }
        return prev;
      });
    } catch {
      setLoading(false);
      setError('Could not load Community right now.');
    }
  }, [loadFeed]);

  useEffect(() => {
    void resolveLocationAndLoad();
  }, [resolveLocationAndLoad]);

  const handlePost = async () => {
    const body = draft.trim();
    if (!body || body.length > MAX_CHARS || posting) return;
    setPosting(true);
    setPostError('');
    try {
      if (viewerLat == null || viewerLng == null) {
        throw new Error('location_required');
      }
      // Refresh pin before create so the post is local.
      await usersAPI.updateLocation(viewerLat, viewerLng).catch(() => {});
      const res = await communityAPI.createPost(body);
      const created = res.data.post;
      setDraft('');
      setPosts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      const code = ax.response?.data?.error;
      if (code === 'location_required') {
        setPostError(ax.response?.data?.message || 'Turn on location so your post is local.');
        setNeedsLocation(true);
      } else {
        setPostError('Could not post. Try again.');
      }
    } finally {
      setPosting(false);
    }
  };

  const remaining = MAX_CHARS - draft.length;

  return (
    <div className={`space-y-4 ${className}`} data-testid="community-feed">
      {!compact ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">
            Local text
          </p>
          <h1 className="text-2xl font-bold text-[var(--cream)]">{ROUTE_LABELS.community}</h1>
          <p className="mt-1 text-sm text-[var(--cream-muted)]">
            Short updates from men nearby — comment on a post. No video, free for all.
          </p>
        </div>
      ) : null}

      {!needsLocation ? (
        <div
          className="rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.08)] p-3 sm:p-4"
          data-testid="community-composer"
        >
          <label htmlFor="community-post-body" className="sr-only">
            Community post
          </label>
          <MentionTextarea
            id="community-post-body"
            data-testid="community-post-input"
            value={draft}
            onChange={setDraft}
            maxLength={MAX_CHARS}
            rows={compact ? 2 : 3}
            placeholder="What's happening nearby? Type @ to mention a Hot Spot or Match"
            className="w-full resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 text-[16px] leading-relaxed text-[var(--cream)] placeholder:text-[var(--cream-muted)] focus:border-[#C4832A] focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={`text-[11px] font-bold tabular-nums ${
                remaining < 20 ? 'text-[#C4832A]' : 'text-[var(--cream-muted)]'
              }`}
              data-testid="community-char-count"
            >
              {remaining}
            </span>
            <button
              type="button"
              data-testid="community-post-submit"
              disabled={posting || draft.trim().length === 0}
              onClick={() => void handlePost()}
              className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
          {postError ? (
            <p className="mt-2 text-[12px] text-[#E0A14A]" role="alert">
              {postError}
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <PulseRing size={32} label="Loading Community" />
        </div>
      ) : needsLocation ? (
        <div
          className="rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] px-6 py-10 text-center"
          data-testid="community-location-gate"
          role="dialog"
          aria-labelledby="community-location-title"
        >
          <p id="community-location-title" className="text-[17px] font-extrabold text-[var(--cream)]">
            We need your location for Community
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--cream-muted)]">
            {error ||
              'Community is local — we need GPS so you only see short posts from men near you.'}
          </p>
          <button
            type="button"
            onClick={() => void resolveLocationAndLoad()}
            className="mt-5 rounded-full bg-[#C4832A] px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
          >
            Allow location
          </button>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#A45E18]/40 bg-[var(--bg-card)] p-5 text-sm text-[var(--cream)]">
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div
          className="rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.08)] px-6 py-10 text-center"
          data-testid="community-empty"
        >
          <p className="text-[16px] font-extrabold text-[var(--cream)]">No posts nearby yet</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--cream-muted)]">
            Be the first — share a short local update (hosting, drinks, open to chat).
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="community-post-list">
          {posts.map((post) => (
            <li
              key={post.id}
              data-testid="community-post"
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/70 px-3 py-3 sm:px-4"
            >
              <div className="flex gap-3">
                <Link to={`/profile/${post.user_id}`} className="shrink-0" aria-label={post.author_name}>
                  <PostAvatar name={post.author_name} photoUrl={post.author_photo_url} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Link
                        to={`/profile/${post.user_id}`}
                        className="truncate text-[14px] font-extrabold text-[var(--cream)] hover:text-[#C4832A]"
                      >
                        {post.author_name}
                      </Link>
                      <span className="text-[11px] font-bold text-[var(--copper)]">
                        {distanceDisplay(post)}
                      </span>
                      <span className="text-[11px] text-[var(--cream-muted)]">
                        {formatRelativeTime(post.created_at)}
                      </span>
                    </div>

                    {currentUserId && currentUserId === post.user_id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {editingPostId !== post.id ? (
                          <>
                            <button
                              type="button"
                              data-testid={`community-post-edit-${post.id}`}
                              onClick={() => startEditPost(post)}
                              className="rounded px-2 py-0.5 text-[11px] font-bold text-[var(--cream-muted)] transition-colors hover:bg-[rgba(196,131,42,0.15)] hover:text-[#E0A14A]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              data-testid={`community-post-delete-${post.id}`}
                              onClick={() => setDeleteConfirmPostId(post.id)}
                              className="rounded px-2 py-0.5 text-[11px] font-bold text-[var(--cream-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {deleteConfirmPostId === post.id ? (
                    <div
                      data-testid={`community-post-delete-confirm-${post.id}`}
                      className="mt-2 rounded-xl border border-red-500/40 bg-red-950/30 p-2.5 text-[12px] text-[var(--cream)]"
                    >
                      <p className="font-semibold text-red-300">Delete this post?</p>
                      <p className="mt-0.5 text-[11px] text-[var(--cream-muted)]">
                        This cannot be undone. Its comments will be removed too.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          data-testid={`community-post-delete-btn-${post.id}`}
                          disabled={deletingPostId === post.id}
                          onClick={() => void handleDeletePost(post.id)}
                          className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                        >
                          {deletingPostId === post.id ? 'Deleting…' : 'Delete post'}
                        </button>
                        <button
                          type="button"
                          data-testid={`community-post-delete-cancel-${post.id}`}
                          disabled={deletingPostId === post.id}
                          onClick={() => setDeleteConfirmPostId(null)}
                          className="rounded-full border border-[var(--border-default)] px-3 py-1 text-[11px] font-bold text-[var(--cream-muted)] hover:text-[var(--cream)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {editingPostId === post.id ? (
                    <div
                      data-testid={`community-post-edit-box-${post.id}`}
                      className="mt-2 space-y-2 rounded-xl border border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.06)] p-2.5"
                    >
                      <MentionTextarea
                        id={`edit-post-${post.id}`}
                        data-testid={`community-post-edit-input-${post.id}`}
                        value={editDraft}
                        onChange={setEditDraft}
                        rows={2}
                        maxChars={MAX_CHARS}
                        placeholder="Edit your post…"
                        className="w-full resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[14px] leading-relaxed text-[var(--cream)] placeholder:text-[var(--cream-muted)] focus:border-[#C4832A] focus:outline-none"
                        autoFocus
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-bold tabular-nums ${
                            MAX_CHARS - editDraft.length < 20
                              ? 'text-[#C4832A]'
                              : 'text-[var(--cream-muted)]'
                          }`}
                        >
                          {MAX_CHARS - editDraft.length}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`community-post-edit-cancel-${post.id}`}
                            disabled={savingEdit}
                            onClick={cancelEditPost}
                            className="rounded-full border border-[var(--border-default)] px-3 py-1 text-[11px] font-bold text-[var(--cream-muted)] hover:text-[var(--cream)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            data-testid={`community-post-edit-save-${post.id}`}
                            disabled={savingEdit || editDraft.trim().length === 0}
                            onClick={() => void handleSaveEditPost(post.id)}
                            className="rounded-full bg-[#C4832A] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                      {editError ? (
                        <p className="text-[11px] text-[#E0A14A]" role="alert">
                          {editError}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--cream-soft)]">
                      {post.body}
                    </p>
                  )}

                  <CommunityPostComments
                    postId={post.id}
                    commentCount={post.comment_count ?? 0}
                    onCountChange={(count) => {
                      setPosts((prev) =>
                        prev.map((p) => (p.id === post.id ? { ...p, comment_count: count } : p)),
                      );
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
