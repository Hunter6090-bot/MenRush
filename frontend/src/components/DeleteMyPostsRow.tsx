import { useRef, useState } from 'react';
import { communityAPI, mapFeedAPI } from '../api/client';
import {
  CONFIRM_BODY,
  CONFIRM_BOX,
  CONFIRM_CANCEL_BTN,
  CONFIRM_DANGER_BTN,
  CONFIRM_TITLE,
} from '../lib/confirmStyles';

/** "1 post" / "3 posts". */
export function postsLabel(n: number): string {
  return `${n} post${n === 1 ? '' : 's'}`;
}

/**
 * Settings row: delete every map and Community post you have made, at any age,
 * including ones that no longer show in the feed. The saved location goes with
 * each post. The confirm says how many will go. 15px text, 44px tap targets.
 */
export function DeleteMyPostsRow() {
  const [counts, setCounts] = useState<{ map: number; community: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const startRef = useRef<HTMLButtonElement>(null);

  const total = counts ? counts.map + counts.community : 0;

  const start = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const [map, community] = await Promise.all([mapFeedAPI.countMine(), communityAPI.countMyPosts()]);
      setCounts({ map: map.data.count ?? 0, community: community.data.count ?? 0 });
    } catch {
      setError('Could not check your posts. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setCounts(null);
    requestAnimationFrame(() => startRef.current?.focus());
  };

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const [map, community] = await Promise.all([mapFeedAPI.deleteAllMine(), communityAPI.deleteAllMyPosts()]);
      const deleted = (map.data.deleted ?? 0) + (community.data.deleted ?? 0);
      setNotice(`Deleted ${postsLabel(deleted)}.`);
      setCounts(null);
      requestAnimationFrame(() => startRef.current?.focus());
    } catch {
      setError('Could not delete your posts. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-5" data-testid="settings-delete-my-posts">
      <p className="text-[15px] font-bold text-[var(--cream)]">Delete my posts</p>
      <p className="mt-0.5 text-[15px] text-[var(--cream-muted)]">
        Removes every map and Community post you&apos;ve made, with the location saved with each one. You can also
        delete a single post from its ••• menu.
      </p>
      {notice ? (
        <p role="status" className="mt-3 text-[15px] font-medium text-[var(--cream)]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-[15px] font-medium text-[var(--nn-danger-text)]">
          {error}
        </p>
      ) : null}

      {counts ? (
        total === 0 ? (
          <div className="mt-3" data-testid="settings-delete-my-posts-none">
            <p className="text-[15px] text-[var(--cream)]">You have no posts to delete.</p>
            <button type="button" onClick={cancel} className={`mt-2 ${CONFIRM_CANCEL_BTN}`}>
              OK
            </button>
          </div>
        ) : (
          <div className={`mt-3 ${CONFIRM_BOX}`} data-testid="settings-delete-my-posts-confirm-box">
            <p className={CONFIRM_TITLE}>Delete all {postsLabel(total)}?</p>
            <p className={CONFIRM_BODY} data-testid="settings-delete-my-posts-summary">
              That&apos;s {postsLabel(counts.map)} on the map and {postsLabel(counts.community)} in Community, with the
              location saved with each one. You can&apos;t undo this.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="settings-delete-my-posts-confirm"
                disabled={busy}
                onClick={() => void run()}
                className={CONFIRM_DANGER_BTN}
              >
                {busy ? 'Deleting…' : `Delete ${postsLabel(total)}`}
              </button>
              <button type="button" disabled={busy} onClick={cancel} className={CONFIRM_CANCEL_BTN}>
                Cancel
              </button>
            </div>
          </div>
        )
      ) : (
        <button
          ref={startRef}
          type="button"
          data-testid="settings-delete-my-posts-start"
          disabled={loading}
          onClick={() => void start()}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--border-default)] px-4 text-[15px] font-bold text-[var(--cream)] hover:border-[var(--copper)] disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Delete my posts…'}
        </button>
      )}
    </div>
  );
}
