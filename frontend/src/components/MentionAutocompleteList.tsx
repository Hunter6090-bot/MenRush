import React, { useEffect, useRef } from 'react';
import type { CommunityMentionSuggestionDTO } from '../api/client';
import { FadedBrandFace, isNearbyPlaceholderFace } from './FadedBrandFace';
import { useResolvingPhotoSrc } from './UserAvatar';

interface MentionItemAvatarProps {
  item: CommunityMentionSuggestionDTO;
}

function MentionItemAvatar({ item }: MentionItemAvatarProps) {
  const { src, onError } = useResolvingPhotoSrc(item.photo_url ?? null);

  if (item.type === 'hot_spot') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(196,131,42,0.18)] text-[13px] text-[#E0A14A] ring-1 ring-[rgba(196,131,42,0.4)]">
        {item.icon || '📍'}
      </div>
    );
  }

  if (src && !isNearbyPlaceholderFace(item.photo_url)) {
    return (
      <img
        src={src}
        alt=""
        onError={onError}
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[rgba(196,131,42,0.35)]"
      />
    );
  }

  return (
    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-[rgba(196,131,42,0.35)]">
      <FadedBrandFace variant="profile" size={28} label={item.name} />
    </div>
  );
}

interface MentionAutocompleteListProps {
  suggestions: CommunityMentionSuggestionDTO[];
  selectedIndex: number;
  loading: boolean;
  onSelect: (item: CommunityMentionSuggestionDTO) => void;
}

export function MentionAutocompleteList({
  suggestions,
  selectedIndex,
  loading,
  onSelect,
}: MentionAutocompleteListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (loading && suggestions.length === 0) {
    return (
      <div
        className="absolute left-0 right-0 bottom-full z-30 mb-1 max-h-56 overflow-y-auto rounded-xl border border-[rgba(196,131,42,0.4)] bg-[#120D07]/95 p-3 text-[12px] text-[var(--cream-muted)] shadow-xl backdrop-blur-md"
        data-testid="mention-autocomplete-loading"
      >
        Finding Hot Spots & Matches…
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute left-0 right-0 bottom-full z-30 mb-1 max-h-60 overflow-y-auto rounded-xl border border-[rgba(196,131,42,0.45)] bg-[#120D07]/95 p-1 shadow-2xl backdrop-blur-md"
      data-testid="mention-autocomplete-list"
      role="listbox"
      aria-label="Mention suggestions"
    >
      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#C4832A]">
        Hot Spots & Matches
      </div>
      <ul ref={listRef} className="space-y-0.5">
        {suggestions.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <li
              key={`${item.type}-${item.id}`}
              role="option"
              aria-selected={isSelected}
              data-testid={`mention-option-${item.type}-${index}`}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                isSelected
                  ? 'bg-[rgba(196,131,42,0.25)] text-[var(--cream)]'
                  : 'text-[var(--cream-soft)] hover:bg-[rgba(196,131,42,0.12)] hover:text-[var(--cream)]'
              }`}
              onMouseDown={(e) => {
                // Prevent textarea from blurring before select
                e.preventDefault();
                onSelect(item);
              }}
            >
              <MentionItemAvatar item={item} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[13px] font-bold text-[var(--cream)]">
                    @{item.name}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-[#C4832A]/80">
                    {item.type === 'hot_spot' ? 'Hot Spot' : 'Match'}
                  </span>
                </div>
                {item.subtitle ? (
                  <p className="truncate text-[11px] text-[var(--cream-muted)]">{item.subtitle}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
