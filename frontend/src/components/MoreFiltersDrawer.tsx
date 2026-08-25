import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DISCOVERY_FILTER_CATEGORIES,
  countActiveDiscoveryFilters,
  type DiscoveryFilterState,
} from '../lib/discoveryFilters';

const MORE_FILTER_IDS = ['vibe', 'scene', 'connection'] as const;

interface MoreFiltersDrawerProps {
  value: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
}

export function MoreFiltersDrawer({ value, onChange }: MoreFiltersDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const extraCount = value.interests.filter((tag) =>
    MORE_FILTER_IDS.some((id) => {
      const cat = DISCOVERY_FILTER_CATEGORIES.find((c) => c.id === id);
      return (cat?.tags as readonly string[] | undefined)?.includes(tag);
    }),
  ).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="more-filters-open"
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
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
                  <div>
                    <h2 id={titleId} className="text-lg font-bold text-[var(--cream)]">
                      More filters
                    </h2>
                    <p className="text-xs text-[var(--cream-muted)]">
                      Vibe, scene and connection — composes with Looking for.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm font-semibold text-[var(--cream-muted)] hover:text-[var(--copper)]"
                    data-testid="more-filters-close"
                  >
                    Done
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                  {MORE_FILTER_IDS.map((id) => {
                    const cat = DISCOVERY_FILTER_CATEGORIES.find((c) => c.id === id);
                    if (!cat) return null;
                    return (
                      <div key={cat.id}>
                        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--cream-muted)]">
                          {cat.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label={cat.label}>
                          {cat.tags.map((tag) => {
                            const active = value.interests.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggle(tag)}
                                className={
                                  active
                                    ? 'mr-pill mr-pill-active'
                                    : 'mr-pill mr-pill-inactive hover:border-[var(--copper)]/40 hover:text-[var(--cream)]'
                                }
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] leading-relaxed text-[var(--cream-muted)]">
                    Free includes this base set. Extra filters can unlock later for Premium.
                    {countActiveDiscoveryFilters(value) > 0
                      ? ` ${countActiveDiscoveryFilters(value)} filter${countActiveDiscoveryFilters(value) === 1 ? '' : 's'} active overall.`
                      : ''}
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
