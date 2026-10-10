import { useState } from 'react';
import { communityAPI, mapFeedAPI } from '../api/client';

/**
 * Settings row: delete every map and Community post you have made, at any age,
 * including ones that no longer show in the feed. The saved location goes with
 * each post. 15px text, 44px tap targets.
 */
export function DeleteMyPostsRow() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const [map, community] = await Promise.all([
        mapFeedAPI.deleteAllMine(),
        communityAPI.deleteAllMyPosts(),
      ]);
      const total = (map.data.deleted ?? 0) + (community.data.deleted ?? 0);
      setNotice(total === 0 ? 'You had no posts to delete.' : `Deleted ${total} post${total === 1 ? '' : 's'}.`);
      setConfirming(false);
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
      {notice ? <p className="mt-3 text-[15px] font-medium text-[var(--cream)]">{notice}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-[15px] font-medium text-[var(--nn-danger-text)]">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="settings-delete-my-posts-confirm"
            disabled={busy}
            onClick={() => void run()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[15px] font-bold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete all my posts'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--border-default)] px-4 text-[15px] font-bold text-[var(--cream)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="settings-delete-my-posts-start"
          onClick={() => setConfirming(true)}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--border-default)] px-4 text-[15px] font-bold text-[var(--cream)] hover:border-[var(--copper)]"
        >
          Delete my posts…
        </button>
      )}
    </div>
  );
}
