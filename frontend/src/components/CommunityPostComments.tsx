import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { communityAPI, type CommunityCommentDTO } from '../api/client';
import { formatRelativeTime } from '../lib/notifications';
import { SilhouetteAvatar } from './SilhouetteAvatar';
import { useResolvingPhotoSrc } from './UserAvatar';

const MAX_CHARS = 280;

function CommentAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const { src, onError } = useResolvingPhotoSrc(photoUrl);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        onError={onError}
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[rgba(196,131,42,0.3)]"
      />
    );
  }
  return (
    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-[rgba(196,131,42,0.3)]">
      <SilhouetteAvatar size={32} variant="card" className="!h-8 !w-8" />
      <span className="sr-only">{name}</span>
    </div>
  );
}

type CommunityPostCommentsProps = {
  postId: string;
  commentCount?: number;
  onCountChange?: (count: number) => void;
};

/**
 * Comments on a Community post — text only, free for all.
 */
export function CommunityPostComments({
  postId,
  commentCount = 0,
  onCountChange,
}: CommunityPostCommentsProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommunityCommentDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const count = loaded ? comments.length : commentCount;
  const remaining = MAX_CHARS - draft.length;

  const loadComments = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await communityAPI.listComments(postId);
      const next = res.data.comments ?? [];
      setComments(next);
      setLoaded(true);
      onCountChange?.(next.length);
    } catch {
      setError('Could not load comments.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) void loadComments();
  };

  const handleReply = async () => {
    const body = draft.trim();
    if (!body || body.length > MAX_CHARS || posting) return;
    setPosting(true);
    setError('');
    try {
      const res = await communityAPI.createComment(postId, body);
      const created = res.data.comment;
      setDraft('');
      setComments((prev) => [...prev.filter((c) => c.id !== created.id), created]);
      setLoaded(true);
      onCountChange?.(comments.filter((c) => c.id !== created.id).length + 1);
    } catch {
      setError('Could not add comment. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const label =
    count === 0 ? 'Comment' : count === 1 ? '1 comment' : `${count} comments`;

  return (
    <div className="mt-2.5" data-testid="community-comments">
      <button
        type="button"
        data-testid="community-comments-toggle"
        onClick={handleToggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-bold text-[var(--cream-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[#C4832A]"
      >
        <CommentBubbleIcon className="h-3.5 w-3.5" />
        {label}
      </button>

      {open ? (
        <div className="mt-2 space-y-2.5 border-t border-[var(--border-default)] pt-2.5">
          {loading && !loaded ? (
            <p className="text-[12px] text-[var(--cream-muted)]">Loading comments…</p>
          ) : loaded && comments.length === 0 ? (
            <p className="text-[12px] text-[var(--cream-muted)]" data-testid="community-comments-empty">
              Be the first to comment.
            </p>
          ) : (
            <ul className="space-y-2.5" data-testid="community-comment-list">
              {comments.map((comment) => (
                <li key={comment.id} data-testid="community-comment" className="flex gap-2">
                  <Link
                    to={`/profile/${comment.user_id}`}
                    className="shrink-0"
                    aria-label={comment.author_name}
                  >
                    <CommentAvatar name={comment.author_name} photoUrl={comment.author_photo_url} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link
                        to={`/profile/${comment.user_id}`}
                        className="truncate text-[13px] font-extrabold text-[var(--cream)] hover:text-[#C4832A]"
                      >
                        {comment.author_name}
                      </Link>
                      <span className="text-[11px] text-[var(--cream-muted)]">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--cream-soft)]">
                      {comment.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div data-testid="community-comment-composer">
            <label htmlFor={`community-comment-${postId}`} className="sr-only">
              Write a comment
            </label>
            <textarea
              id={`community-comment-${postId}`}
              data-testid="community-comment-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
              maxLength={MAX_CHARS}
              rows={2}
              placeholder="Write a comment…"
              className="w-full resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] leading-relaxed text-[var(--cream)] placeholder:text-[var(--cream-muted)] focus:border-[#C4832A] focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  remaining < 20 ? 'text-[#C4832A]' : 'text-[var(--cream-muted)]'
                }`}
              >
                {remaining}
              </span>
              <button
                type="button"
                data-testid="community-comment-submit"
                disabled={posting || draft.trim().length === 0}
                onClick={() => void handleReply()}
                className="rounded-full bg-[#C4832A] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {posting ? 'Sending…' : 'Reply'}
              </button>
            </div>
          </div>
          {error ? (
            <p className="text-[12px] text-[#E0A14A]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const CommentBubbleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path d="M21 12c0 3.9-4 7-9 7-1.1 0-2.1-.1-3.1-.4L4 20l1.1-3.3C4.4 15.6 4 13.9 4 12c0-3.9 4-7 9-7s8 3.1 8 7z" />
  </svg>
);
