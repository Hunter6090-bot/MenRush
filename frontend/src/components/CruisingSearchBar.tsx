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
      className={`group flex items-center gap-2 rounded-full border border-[rgba(196,131,42,0.35)] bg-[rgba(13,10,6,0.85)] px-3.5 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all hover:border-[rgba(196,131,42,0.7)] hover:bg-[rgba(13,10,6,0.95)] ${className}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#E0A14A] transition-transform group-hover:scale-110">
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
      <span className="text-[12px] font-bold tracking-wide text-[var(--cream-soft)] group-hover:text-[var(--cream)]">
        Search cruising spots…
      </span>
      <span className="ml-1 rounded bg-[#C4832A]/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#E0A14A]">
        Outdoor
      </span>
    </button>
  );
}
