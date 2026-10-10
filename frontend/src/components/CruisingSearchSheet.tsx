import { useEffect, useMemo, useRef, useState } from 'react';
import type { HotSpotDTO } from '../api/client';
import { hotSpotsAPI } from '../api/client';
import {
  CruisingCategory,
  CRUISING_CATEGORIES,
  CRUISING_CATEGORY_META,
  mapToCruisingCategory,
  isValidCoordinateSpot,
} from '../lib/cruising';
import { CruisingSpotCard } from './CruisingSpotCard';
import { PulseRing } from './PulseRing';
import { IconClose } from './icons';

interface CruisingSearchSheetProps {
  open: boolean;
  onClose: () => void;
  lat: number | null;
  lng: number | null;
  onSelectSpot?: (spot: HotSpotDTO) => void;
  onCheckIn?: (spot: HotSpotDTO, anonymous: boolean) => void | Promise<void>;
  onOpenReviews?: (spot: HotSpotDTO) => void;
  actingSpotId?: string | null;
  initialQuery?: string;
}

export function CruisingSearchSheet({
  open,
  onClose,
  lat,
  lng,
  onSelectSpot,
  onCheckIn,
  onOpenReviews,
  actingSpotId,
  initialQuery = '',
}: CruisingSearchSheetProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<CruisingCategory | 'all'>('all');
  const [spots, setSpots] = useState<HotSpotDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync initial query when opened
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setSelectedCategory('all');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, initialQuery]);

  // Fetch spots on open or when query changes (debounced)
  useEffect(() => {
    if (!open) return;
    if (lat == null || lng == null) {
      setError('Location required to find cruising spots near you.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const res = await hotSpotsAPI.searchCruising(lat, lng, query);
        if (!cancelled) {
          const rawSpots = res.data.spots ?? [];
          // Strict filter: only spots with valid real coordinates appear
          const validSpots = rawSpots.filter(isValidCoordinateSpot);
          setSpots(validSpots);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[cruising-search] failed to load spots', err);
          setError('Could not load cruising spots. Check your connection.');
          setSpots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 200 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, lat, lng, query]);

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Filter spots by category and ensure closest first
  const filteredSpots = useMemo(() => {
    let result = spots;
    if (selectedCategory !== 'all') {
      result = result.filter((spot) => mapToCruisingCategory(spot) === selectedCategory);
    }
    // Ensure sorted closest first
    return [...result].sort((a, b) => {
      const distA = a.distance_km != null ? Number(a.distance_km) : Infinity;
      const distB = b.distance_km != null ? Number(b.distance_km) : Infinity;
      return distA - distB;
    });
  }, [spots, selectedCategory]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cruising spots search"
      data-testid="cruising-search-sheet"
      className="fixed inset-0 z-[65] flex items-end justify-center lg:items-center"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Sheet panel */}
      <div className="relative flex h-[85vh] max-h-[720px] w-full max-w-2xl flex-col rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl lg:h-[80vh] lg:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C4832A]/20 text-[#E0A14A]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <h2 className="text-base font-extrabold text-[var(--cream)]">
              Cruising Spots
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close cruising search"
            data-testid="cruising-search-close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--cream-muted)] transition-colors hover:bg-white/5 hover:text-[var(--cream)]"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Search input & category pills */}
        <div className="shrink-0 space-y-2.5 border-b border-[var(--border-default)]/60 bg-[var(--bg-elevated)]/60 px-4 py-3 sm:px-6">
          {/* Search bar */}
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-[var(--cream-muted)]">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by spot name, city, woods, layby, sauna…"
              data-testid="cruising-search-input"
              className="w-full rounded-full border border-[var(--border-default)] bg-[#14120E] py-2 pl-9 pr-9 text-sm text-[var(--cream)] placeholder-[var(--cream-muted)] focus:border-[var(--copper)] focus:outline-none focus:ring-1 focus:ring-[var(--copper)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search query"
                className="absolute right-3 text-sm text-[var(--cream-muted)] hover:text-[var(--cream)]"
              >
                ×
              </button>
            ) : null}
          </div>

          {/* Category filter pills: All | Woods | Beach | Layby | Park | Sauna */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar"
            role="tablist"
            aria-label="Category filters"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-3 py-1 font-bold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#C4832A] text-[#1A0E03]'
                  : 'border border-[var(--border-default)] bg-black/20 text-[var(--cream-soft)] hover:border-[var(--copper)]/40'
              }`}
            >
              All spots
            </button>
            {CRUISING_CATEGORIES.map((catKey) => {
              const meta = CRUISING_CATEGORY_META[catKey];
              const isSelected = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-[#C4832A] text-[#1A0E03]'
                      : 'border border-[var(--border-default)] bg-black/20 text-[var(--cream-soft)] hover:border-[var(--copper)]/40'
                  }`}
                >
                  <span aria-hidden="true">{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable list of spots */}
        <div
          data-testid="cruising-spots-list"
          className="flex-1 overflow-y-auto p-4 space-y-3 sm:px-6 overscroll-contain"
        >
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {loading && spots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PulseRing size={32} label="Finding spots" />
              <p className="mt-3 text-xs font-semibold text-[var(--cream-muted)]">
                Locating nearby spots…
              </p>
            </div>
          ) : filteredSpots.length === 0 && !loading ? (
            <div
              data-testid="cruising-search-empty"
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <span className="text-3xl" aria-hidden="true">
                {selectedCategory !== 'all' ? CRUISING_CATEGORY_META[selectedCategory].icon : '🌲'}
              </span>
              <p className="mt-2 text-sm font-bold text-[var(--cream)]">
                No spots found
              </p>
              <p className="mt-1 max-w-xs text-xs text-[var(--cream-muted)]">
                {query
                  ? `No matches for "${query}". Try searching another name or category.`
                  : 'No cruising spots found nearby. Try expanding your search.'}
              </p>
              {query || selectedCategory !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSelectedCategory('all');
                  }}
                  className="mt-4 rounded-full border border-[var(--copper)]/50 px-4 py-1.5 text-xs font-bold text-[#E0A14A] hover:bg-[#C4832A]/10"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold text-[var(--cream-muted)]">
                {filteredSpots.length}{' '}
                {filteredSpots.length === 1 ? 'spot' : 'spots'} nearby · closest first
              </p>
              {filteredSpots.map((spot) => (
                <CruisingSpotCard
                  key={spot.id}
                  spot={spot}
                  onSelect={(selected) => {
                    onSelectSpot?.(selected);
                    onClose();
                  }}
                  onCheckIn={onCheckIn}
                  onOpenReviews={onOpenReviews}
                  acting={actingSpotId === spot.id}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer info note */}
        <div className="shrink-0 border-t border-[var(--border-default)]/40 bg-[var(--bg-elevated)]/40 px-4 py-2 text-center text-[10px] text-[var(--cream-muted)] sm:px-6">
          <span>Outdoor locations for consenting adults (18+). One tap to maps navigation.</span>
        </div>
      </div>
    </div>
  );
}
