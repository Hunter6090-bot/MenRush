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

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setError('');
      return;
    }
    inputRef.current?.focus();
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
          setError(err?.response?.data?.error || 'Search failed.');
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

  const openProfile = (id: string) => {
    onClose();
    navigate(`/profile/${id}`);
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
          {results.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => openProfile(hit.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#3D2B0E]/55"
            >
              <UserAvatar name={hit.name} photoUrl={hit.photo_url} size="sm" showStatus={false} />
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
          ))}
        </div>
      </div>
    </div>
  );
}

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
  </svg>
);
