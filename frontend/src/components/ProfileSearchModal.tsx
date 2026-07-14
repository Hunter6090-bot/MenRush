import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { UserAvatar } from './UserAvatar';

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

export function ProfileSearchModal({ open, onClose }: ProfileSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
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
        .searchProfiles(term)
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
          } else {
            setError(typeof code === 'string' ? code.replace(/_/g, ' ') : 'Search failed.');
          }
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [open, query]);

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
    navigate(`/profile/${id}`);
  };

  const handleMatch = async (hit: SearchHit) => {
    if (matchingId) return;
    if (mutualIds.has(hit.id)) {
      onClose();
      navigate(`/messages/${hit.id}`);
      return;
    }
    if (likedIds.has(hit.id)) {
      flash(`Match already sent to ${hit.name}. Chat unlocks when he matches back.`);
      return;
    }
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

  const handlePass = (hit: SearchHit) => {
    setResults((prev) => prev.filter((r) => r.id !== hit.id));
    flash(`Passed on ${hit.name}.`);
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
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#3D2B0E] bg-[#0D0A06] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#3D2B0E] px-3 py-3">
          <SearchIcon className="w-4 h-4 shrink-0 text-[#A89070]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#F0E0C0] placeholder:text-[#A89070]/70 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-[#A89070] hover:text-[#F0E0C0]"
          >
            Close
          </button>
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
              color: notice.tone === 'success' ? '#8FC773' : '#F0E0C0',
            }}
          >
            {notice.msg}
          </div>
        ) : null}

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {query.trim().length < 2 && (
            <p className="px-2 py-6 text-center text-sm text-[#A89070]">Type at least 2 characters.</p>
          )}
          {loading && query.trim().length >= 2 && (
            <p className="px-2 py-6 text-center text-sm text-[#A89070]">Searching…</p>
          )}
          {error && (
            <p className="px-2 py-4 text-center text-sm text-[#EF4444]">{error}</p>
          )}
          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-[#A89070]">No profiles found.</p>
          )}
          {results.map((hit) => {
            const liked = likedIds.has(hit.id);
            const mutual = mutualIds.has(hit.id);
            const matching = matchingId === hit.id;
            return (
              <div
                key={hit.id}
                className="rounded-xl px-2 py-2.5 transition-colors hover:bg-[#3D2B0E]/35"
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
                    age={hit.age}
                    size="sm"
                    showStatus={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#F0E0C0]">
                      {hit.name}
                      {hit.age ? <span className="font-normal text-[#A89070]"> · {hit.age}</span> : null}
                    </p>
                    {(hit.headline || hit.bio) && (
                      <p className="truncate text-xs text-[#A89070]">{hit.headline || hit.bio}</p>
                    )}
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                  <button
                    type="button"
                    onClick={() => handlePass(hit)}
                    className="rounded-full border border-[#3D2B0E] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#A89070] hover:border-[#C4832A]/40 hover:text-[#F0E0C0]"
                  >
                    Pass
                  </button>
                  <button
                    type="button"
                    disabled={matching}
                    onClick={() => void handleMatch(hit)}
                    data-testid={`search-match-${hit.id}`}
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-60 ${
                      mutual
                        ? 'border border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.15)] text-[#E0A14A]'
                        : liked
                          ? 'border border-[rgba(196,131,42,0.5)] text-[#C4832A]'
                          : 'bg-[#C4832A] text-[#1A0E03] hover:bg-[#E0A14A]'
                    }`}
                  >
                    {matching ? '…' : mutual ? 'Chat' : liked ? 'Matched' : 'Match'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMessage(hit)}
                    className="rounded-full border border-[#3D2B0E] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#A89070] hover:border-[#C4832A]/40 hover:text-[#C4832A]"
                  >
                    Message
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="border-t border-[#3D2B0E] px-3 py-2 text-center text-[10px] text-[#A89070]">
          Match first · Chat unlocks when mutual · 18+ only
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
