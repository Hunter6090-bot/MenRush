import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  countMoreFilterSelections,
  getMoreFilterCategories,
  type DiscoveryFilterState,
} from '../lib/discoveryFilters';

interface MoreFiltersDrawerProps {
  value: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
}

function pillClass(active: boolean) {
  return active
    ? 'mr-pill mr-pill-active'
    : 'mr-pill mr-pill-inactive hover:border-[var(--copper)]/40 hover:text-[var(--cream)]';
}

/**
 * Bottom/centre sheet for vibe, scene, and connection tags.
 * Composes with Looking for / mood / status via shared DiscoveryFilterState — no new nav tab.
 */
export function MoreFiltersDrawer({ value, onChange }: MoreFiltersDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const extraCount = countMoreFilterSelections(value);
  const categories = getMoreFilterCategories();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const toggle = (tag: string) => {
    onChange({
      ...value,
      interests: value.interests.includes(tag)
        ? value.interests.filter((t) => t !== tag)
        : [...value.interests, tag],
    });
  };

  const clearMore = () => {
    const moreTags = new Set(categories.flatMap((category) => category.tags as readonly string[]));
    onChange({
      ...value,
      interests: value.interests.filter((tag) => !moreTags.has(tag)),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="more-filters-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
          extraCount > 0
            ? 'border-[var(--copper)] bg-[var(--copper)]/15 text-[var(--copper)]'
            : 'border-[var(--border-default)] bg-[var(--bg-elevated)]/85 text-[var(--cream-soft)] hover:border-[var(--copper)]/40'
        }`}
      >
        More filters
        {extraCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--copper)] px-1 text-[10px] font-black text-[var(--bg-primary)]">
            {extraCount}
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[180] flex items-end justify-center sm:items-center"
              style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
              onClick={() => setOpen(false)}
              role="presentation"
              data-testid="more-filters-drawer"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[min(88dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-2xl sm:rounded-3xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4">
                  <div>
                    <h2 id={titleId} className="text-lg font-bold text-[var(--cream)]">
                      More filters
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--cream-muted)]">
                      Vibe, scene and connection — works with Looking for, mood and status.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {extraCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearMore}
                        className="text-sm font-semibold text-[var(--cream-muted)] hover:text-[var(--copper)]"
                        data-testid="more-filters-clear"
                      >
                        Clear
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-sm font-semibold text-[var(--copper)] hover:text-[var(--cream)]"
                      data-testid="more-filters-close"
                    >
                      Done
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                  {categories.map((category) => (
                    <div key={category.id}>
                      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--cream-muted)]">
                        {category.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={category.label}>
                        {category.tags.map((tag) => {
                          const active = value.interests.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggle(tag)}
                              className={pillClass(active)}
                              data-testid={`more-filter-tag-${tag}`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
