import React, { useCallback, useEffect, useRef, useState } from 'react';
import { communityAPI, type CommunityMentionSuggestionDTO } from '../api/client';
import { applyMentionReplacement, getActiveMention, type MentionActiveMatch } from '../lib/mentions';
import { MentionAutocompleteList } from './MentionAutocompleteList';

export interface MentionTextareaProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  maxChars?: number;
  maxLength?: number;
  className?: string;
  'data-testid'?: string;
  autoFocus?: boolean;
}

export function MentionTextarea({
  id,
  value,
  onChange,
  placeholder = "What's happening nearby? Type @ to mention a Hot Spot or Match",
  rows = 3,
  maxChars = 280,
  maxLength,
  className = '',
  'data-testid': testId = 'mention-textarea',
  autoFocus = false,
}: MentionTextareaProps) {
  const effectiveMax = maxLength ?? maxChars;
  const [mentionSuggestions, setMentionSuggestions] = useState<CommunityMentionSuggestionDTO[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionActive, setMentionActive] = useState<MentionActiveMatch | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkMentionState = useCallback((text: string, cursorPos: number) => {
    const active = getActiveMention(text, cursorPos);
    setMentionActive(active);
    if (!active) {
      setMentionSuggestions([]);
      setMentionSelectedIndex(0);
    }
  }, []);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!mentionActive) return;

    let cancelled = false;
    setMentionLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await communityAPI.getMentionSuggestions(mentionActive.query, 10);
        if (!cancelled) {
          setMentionSuggestions(res.data.suggestions ?? []);
          setMentionSelectedIndex(0);
        }
      } catch {
        if (!cancelled) {
          setMentionSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setMentionLoading(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mentionActive?.query]);

  // Dismiss on outside click
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMentionActive(null);
        setMentionSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const handleSelectMention = useCallback(
    (item: CommunityMentionSuggestionDTO) => {
      if (!mentionActive) return;
      const { newText, newCursorPos } = applyMentionReplacement(
        value,
        mentionActive.startIndex,
        mentionActive.endIndex,
        item.name,
        effectiveMax,
      );
      onChange(newText);
      setMentionActive(null);
      setMentionSuggestions([]);
      setMentionSelectedIndex(0);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [value, mentionActive, effectiveMax, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionActive && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((prev) =>
          prev <= 0 ? mentionSuggestions.length - 1 : prev - 1,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = mentionSuggestions[mentionSelectedIndex] ?? mentionSuggestions[0];
        if (item) {
          handleSelectMention(item);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionActive(null);
        setMentionSuggestions([]);
        return;
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {mentionActive ? (
        <MentionAutocompleteList
          suggestions={mentionSuggestions}
          selectedIndex={mentionSelectedIndex}
          loading={mentionLoading}
          onSelect={handleSelectMention}
        />
      ) : null}
      <textarea
        ref={textareaRef}
        id={id}
        data-testid={testId}
        value={value}
        onChange={(e) => {
          const val = e.target.value.slice(0, effectiveMax);
          onChange(val);
          checkMentionState(val, e.target.selectionEnd ?? val.length);
        }}
        onClick={(e) => {
          const pos = (e.target as HTMLTextAreaElement).selectionEnd ?? value.length;
          checkMentionState(value, pos);
        }}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            const pos = (e.target as HTMLTextAreaElement).selectionEnd ?? value.length;
            checkMentionState(value, pos);
          }
        }}
        onKeyDown={handleKeyDown}
        maxLength={effectiveMax}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}
