import { useEffect, useId, useRef, useState } from 'react';
import {
  AGE_PRESETS,
  DISCOVERY_FILTER_CATEGORIES,
  MOOD_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  countActiveDiscoveryFilters,
  type DiscoveryFilterState,
} from '../lib/discoveryFilters';

interface DiscoveryFilterPanelProps {
  value: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
  /** Compact overlay for map; inline expands above map on desktop. */
  variant?: 'compact' | 'inline';
  className?: string;
}

function pillClass(active: boolean) {
  return active ? 'mr-pill mr-pill-active' : 'mr-pill mr-pill-inactive hover:border-[var(--copper)]/40 hover:text-[var(--cream)]';
}

export function DiscoveryFilterPanel({
  value,
  onChange,
  variant = 'compact',
  className = '',
}: DiscoveryFilterPanelProps) {
  const [open, setOpen] = useState(variant === 'inline');
  const [activeCategory, setActiveCategory] = useState<string>(DISCOVERY_FILTER_CATEGORIES[0].id);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCount = countActiveDiscoveryFilters(value);

  useEffect(() => {
    if (variant !== 'compact' || !open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, variant]);

  const toggleInterest = (tag: string) => {
    onChange({
      ...value,
      interests: value.interests.includes(tag)
        ? value.interests.filter((t) => t !== tag)
        : [...value.interests, tag],
    });
  };

  const setIntent = (intent: string) => {
    onChange({ ...value, intent });
  };

  const toggleStatus = (id: (typeof STATUS_FILTER_OPTIONS)[number]['id']) => {
    onChange({
      ...value,
      status: value.status.includes(id) ? value.status.filter((s) => s !== id) : [...value.status, id],
    });
  };

  const clearAll = () => {
    onChange({
      intent: 'All',
      interests: [],
      agePreset: 'any',
      status: [],
      mood: undefined,
    });
  };

  const category = DISCOVERY_FILTER_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div ref={rootRef} className={`relative ${className}`} data-testid="discovery-filter-panel">
      <div className="flex flex-wrap items-center gap-2">
        {variant === 'compact' ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
              open || activeCount > 0
                ? 'border-[var(--copper)] bg-[var(--copper)]/15 text-[var(--copper)]'
                : 'border-[var(--border-default)] bg-[var(--bg-elevated)]/85 text-[var(--cream-soft)] hover:border-[var(--copper)]/40'
            }`}
          >
            Filters
            {activeCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--copper)] px-1 text-[10px] font-black text-[var(--bg-primary)]">
                {activeCount}
              </span>
            ) : null}
          </button>
        ) : (
          <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--cream-muted)]">Filters</p>
        )}

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-semibold text-[var(--cream-muted)] transition-colors hover:text-[var(--copper)]"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {(variant === 'inline' || open) && (
        <div
          id={panelId}
          className={
            variant === 'compact'
              ? 'absolute left-0 right-0 top-full z-40 mt-2 max-h-[min(52vh,360px)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/95 shadow-[var(--shadow-md)] backdrop-blur-md'
              : 'mt-3 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]'
          }
        >
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-default)] px-2 py-2">
            {DISCOVERY_FILTER_CATEGORIES.map((cat) => {
              const selectedInCategory =
                cat.id === 'looking_for'
                  ? value.intent !== 'All'
                    ? 1
                    : 0
                  : value.interests.filter((tag) => (cat.tags as readonly string[]).includes(tag)).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-[var(--copper)] text-[var(--bg-primary)]'
                      : 'bg-[var(--bg-primary)]/60 text-[var(--cream-muted)] hover:text-[var(--cream)]'
                  }`}
                >
                  {cat.label}
                  {selectedInCategory > 0 ? ` · ${selectedInCategory}` : ''}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActiveCategory('age')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                activeCategory === 'age'
                  ? 'bg-[var(--copper)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-primary)]/60 text-[var(--cream-muted)] hover:text-[var(--cream)]'
              }`}
            >
              Age{value.agePreset !== 'any' ? ' · 1' : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('status')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                activeCategory === 'status'
                  ? 'bg-[var(--copper)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-primary)]/60 text-[var(--cream-muted)] hover:text-[var(--cream)]'
              }`}
            >
              Status{value.status.length > 0 ? ` · ${value.status.length}` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('mood')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                activeCategory === 'mood'
                  ? 'bg-[var(--copper)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-primary)]/60 text-[var(--cream-muted)] hover:text-[var(--cream)]'
              }`}
            >
              Mood{value.mood ? ' · 1' : ''}
            </button>
          </div>

          <div className="max-h-[min(40vh,280px)] overflow-y-auto px-3 py-3">
            {activeCategory === 'age' ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Age range">
                {AGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={value.agePreset === preset.id}
                    onClick={() => onChange({ ...value, agePreset: preset.id })}
                    className={pillClass(value.agePreset === preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            {activeCategory === 'status' ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status filters">
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={value.status.includes(option.id)}
                    onClick={() => toggleStatus(option.id)}
                    className={pillClass(value.status.includes(option.id))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {activeCategory === 'mood' ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mood filters">
                <button
                  type="button"
                  aria-pressed={!value.mood}
                  onClick={() => onChange({ ...value, mood: undefined })}
                  className={pillClass(!value.mood)}
                >
                  Any mood
                </button>
                {MOOD_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={value.mood === option.value}
                    onClick={() =>
                      onChange({
                        ...value,
                        mood: value.mood === option.value ? undefined : option.value,
                      })
                    }
                    className={pillClass(value.mood === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {category ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${category.label} filters`}>
                {category.tags.map((tag) => {
                  const isLookingFor = category.id === 'looking_for';
                  const active = isLookingFor ? value.intent === tag : value.interests.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => (isLookingFor ? setIntent(tag) : toggleInterest(tag))}
                      className={pillClass(active)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}