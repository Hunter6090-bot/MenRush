import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { UserAvatar } from './UserAvatar';
import { profilePathForUser } from '../lib/profileLinks';
import { useAuthStore } from '../hooks/store';
import {
  matchCtaAriaLabel,
  matchCtaCompactToneClasses,
  matchCtaDisabled,
  matchCtaLabel,
  matchInterestState,
} from '../lib/matchCta';
import { IconMatches, IconChat } from './icons';

interface ProfileSearchModalProps {
  open: boolean;
  onClose: () => void;
}

interface SearchHit {
  id: string;
  name: string;
  age?: number;
  photo_url?: string;
  bio?: string;
  headline?: string;
}

type SearchBy = 'name' | 'place';

export function ProfileSearchModal({ open, onClose }: ProfileSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [searchBy, setSearchBy] = useState<SearchBy>('name');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSearchBy('name');
      setResults([]);
      setError('');
      setNotice(null);
      return;
    }
    inputRef.current?.focus();
    // Hydrate Match CTA state for search hits.
    Promise.all([
      usersAPI.getSentLikes().catch(() => ({ data: { ids: [] as string[] } })),
      usersAPI.getMatches().catch(() => ({ data: [] as Array<{ id: string }> })),
    ]).then(([sentRes, matchesRes]) => {
      const sent = sentRes.data?.ids ?? [];
      const mutual = (matchesRes.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
      setMutualIds(new Set(mutual));
      setLikedIds(new Set([...sent, ...mutual]));
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      usersAPI
        .searchProfiles(term, searchBy)
        .then((res) => setResults(res.data))
        .catch((err) => {
          setResults([]);
          const status = err?.response?.status;
          const code = err?.response?.data?.error;
          if (!err?.response) {
            setError('Could not reach the server. Check your connection.');
          } else if (status === 403 && code === 'verification_required') {
            setError('Verify your account to search profiles.');
          } else if (status === 404) {
            setError('Search is unavailable — the server may need updating.');
          } else if (searchBy === 'place') {
            // Never show raw error codes (e.g. place_lookup_failed).
            const human =
              typeof code === 'string' &&
              code.length > 0 &&
              !/^[a-z0-9_]+$/i.test(code)
                ? code
                : "Couldn't look up that place. Try another UK or Ireland town or city.";
            setError(human);
          } else {
            setError('Search failed. Please try again.');
          }
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [open, query, searchBy]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const flash = (msg: string, tone: 'success' | 'error' = 'success') => {
    setNotice({ msg, tone });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const openProfile = (id: string) => {
    onClose();
    navigate(profilePathForUser(id, useAuthStore.getState().user?.id));
  };

  const handleMatch = async (hit: SearchHit) => {
    if (matchingId) return;
    if (mutualIds.has(hit.id)) {
      onClose();
      navigate(`/messages/${hit.id}`);
      return;
    }
    if (likedIds.has(hit.id)) return;
    setMatchingId(hit.id);
    try {
      const res = await usersAPI.likeUser(hit.id);
      setLikedIds((prev) => new Set([...prev, hit.id]));
      if (res.data?.match) {
        setMutualIds((prev) => new Set([...prev, hit.id]));
        flash(`You matched with ${hit.name}.`);
      } else {
        flash(`Match sent to ${hit.name}. Chat unlocks if he matches back · consent first.`);
      }
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      flash(
        typeof apiError === 'string' && apiError.length > 0
          ? apiError
          : 'Could not send match. Try again.',
        'error',
      );
    } finally {
      setMatchingId(null);
    }
  };

  const handleMessage = (hit: SearchHit) => {
    if (mutualIds.has(hit.id)) {
      onClose();
      navigate(`/messages/${hit.id}`);
      return;
    }
    flash('Chat unlocks after a mutual match. Tap Match first · consent first.');
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-20 sm:pt-24"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search profiles"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-3 py-3">
          <div
            role="group"
            aria-label="Search by"
            data-testid="profile-search-mode"
            className="mb-2 inline-flex min-h-[36px] items-stretch overflow-hidden rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.08)]"
          >
            <button
              type="button"
              data-testid="profile-search-mode-name"
              aria-pressed={searchBy === 'name'}
              onClick={() => setSearchBy('name')}
              className={
                searchBy === 'name'
                  ? 'min-h-[36px] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1A0E03] bg-[#C4832A] transition-colors'
                  : 'min-h-[36px] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#E0A14A] transition-colors hover:bg-[rgba(196,131,42,0.18)]'
              }
            >
              Name
            </button>
            <button
              type="button"
              data-testid="profile-search-mode-place"
              aria-pressed={searchBy === 'place'}
              onClick={() => setSearchBy('place')}
              className={
                searchBy === 'place'
                  ? 'min-h-[36px] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1A0E03] bg-[#C4832A] transition-colors'
                  : 'min-h-[36px] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#E0A14A] transition-colors hover:bg-[rgba(196,131,42,0.18)]'
              }
            >
              Town or city
            </button>
          </div>
          <div className="flex items-center gap-2">
            <SearchIcon className="w-4 h-4 shrink-0 text-[var(--cream-muted)]" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                searchBy === 'place' ? 'Town or city in the UK or Ireland…' : 'Search by name…'
              }
              aria-label={searchBy === 'place' ? 'Search by town or city' : 'Search by name'}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--cream)] placeholder:text-[var(--cream-muted)]/70 focus:outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]"
            >
              Close
            </button>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="mx-3 mt-2 rounded-lg border px-3 py-2 text-[11px] font-medium"
            style={{
              borderColor:
                notice.tone === 'success' ? 'rgba(143,199,115,0.4)' : 'rgba(196,131,42,0.45)',
              background:
                notice.tone === 'success' ? 'rgba(143,199,115,0.12)' : 'rgba(196,131,42,0.1)',
              color: notice.tone === 'success' ? '#8FC773' : 'var(--cream)',
            }}
          >
            {notice.msg}
          </div>
        ) : null}

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {query.trim().length < 2 && (
            <p className="px-2 py-6 text-center text-sm text-[var(--cream-muted)]">
              {searchBy === 'place'
                ? 'Type a UK or Ireland town or city.'
                : 'Type at least 2 characters.'}
            </p>
          )}
          {loading && query.trim().length >= 2 && (
            <p className="px-2 py-6 text-center text-sm text-[var(--cream-muted)]">Searching…</p>
          )}
          {error && (
            <p className="px-2 py-4 text-center text-sm text-[#EF4444]">{error}</p>
          )}
          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-[var(--cream-muted)]">
              {searchBy === 'place'
                ? 'No profiles pinned in that UK or Ireland place.'
                : 'No profiles found.'}
            </p>
          )}
          {results.map((hit) => {
            const liked = likedIds.has(hit.id);
            const mutual = mutualIds.has(hit.id);
            const matching = matchingId === hit.id;
            const matchState = matchInterestState({ liked, mutual });
            const matchDisabled = matchCtaDisabled(matchState, matching);
            return (
              <div
                key={hit.id}
                className="rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--border-default)]/35"
                data-testid={`search-hit-${hit.id}`}
              >
                <button
                  type="button"
                  onClick={() => openProfile(hit.id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <UserAvatar
                    name={hit.name}
                    photoUrl={hit.photo_url}
                    userId={hit.id}
                    linkToProfile={false}
                    age={hit.age}
                    size="sm"
                    showStatus={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--cream)]">
                      {hit.name}
                      {hit.age ? <span className="font-normal text-[var(--cream-muted)]"> · {hit.age}</span> : null}
                    </p>
                    {(hit.headline || hit.bio) && (
                      <p className="truncate text-xs text-[var(--cream-muted)]">{hit.headline || hit.bio}</p>
                    )}
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-11">
                  <button
                    type="button"
                    disabled={matchDisabled}
                    aria-disabled={matchDisabled}
                    aria-label={matchCtaAriaLabel(matchState, hit.name, {
                      mutualOpensChat: true,
                    })}
                    title={matching ? 'Sending…' : matchState === 'outgoing' ? 'Sent' : 'Match'}
                    onClick={() => void handleMatch(hit)}
                    data-testid={`search-match-${hit.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide ${
                      matchState === 'none' || matching ? 'uppercase' : ''
                    } ${matchCtaCompactToneClasses(matchState)}`}
                  >
                    <IconMatches size={14} />
                    <span>{matchCtaLabel(matchState, hit.name, {
                      sending: matching,
                      mutualLabel: 'chat',
                    })}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMessage(hit)}
                    title="Chat"
                    aria-label={`Chat with ${hit.name}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--cream-muted)] hover:border-[#C4832A]/40 hover:text-[#C4832A]"
                  >
                    <IconChat size={14} />
                    <span>Chat</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
        <p className="border-t border-[var(--border-default)] px-3 py-2 text-center text-[10px] text-[var(--cream-muted)]">
          Match first · Chat unlocks when mutual
        </p>
      </div>
    </div>
  );
}

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
  </svg>
);
