interface CruisingSearchBarProps {
  onOpen: () => void;
  className?: string;
}

export function CruisingSearchBar({ onOpen, className = '' }: CruisingSearchBarProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="cruising-search-bar"
      aria-label="Search cruising spots"
      className={`group flex items-center gap-2 rounded-full min-h-[44px] border border-[color-mix(in_srgb,var(--copper)_35%,transparent)] bg-[var(--bg-card)] px-3.5 py-1.5 shadow-[var(--shadow-lg)] transition-all hover:border-[color-mix(in_srgb,var(--copper)_70%,transparent)] ${className}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--nn-accent-text)] transition-transform group-hover:scale-110">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-wide text-[var(--cream-soft)] group-hover:text-[var(--cream)]">
        Search cruising spots…
      </span>
      <span className="ml-1 rounded bg-[color-mix(in_srgb,var(--copper)_12%,transparent)] px-1.5 py-0.5 text-[15px] font-extrabold uppercase tracking-wider text-[var(--nn-accent-text)]">
        Outdoor
      </span>
    </button>
  );
}
