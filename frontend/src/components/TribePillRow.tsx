import React from 'react';

const TRIBE_TAGS = [
  'Top',
  'Vers',
  'Bottom',
  'Twink',
  'Jock',
  'Bear',
  'Daddy',
  'Hosting',
  'Right Now',
  'Dating',
];

interface TribePillRowProps {
  selected: string[];
  onToggle: (tag: string) => void;
  onClear?: () => void;
}

export const TribePillRow: React.FC<TribePillRowProps> = ({ selected, onToggle, onClear }) => (
  <div className="flex items-center gap-2 overflow-x-auto px-3 pb-1">
    {TRIBE_TAGS.map((tag) => {
      const active = selected.includes(tag);
      return (
        <button
          key={tag}
          type="button"
          onClick={() => onToggle(tag)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
            active
              ? 'bg-nn-copper text-[#1A0E03] border border-transparent shadow-[0_0_14px_rgba(196,131,42,0.27)]'
              : 'bg-nn-copper/7 text-nn-text border border-nn-border hover:border-nn-copper/40'
          }`}
        >
          {tag}
        </button>
      );
    })}
    {onClear && selected.length > 0 && (
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-full border border-nn-border px-3 py-1.5 text-xs font-medium text-nn-muted hover:border-nn-copper/40 hover:text-nn-text transition-colors"
      >
        Clear
      </button>
    )}
  </div>
);
