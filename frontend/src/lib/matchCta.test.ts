import { describe, expect, it } from 'vitest';
import {
  matchCtaAriaLabel,
  matchCtaDisabled,
  matchCtaLabel,
  matchInterestState,
} from './matchCta';

describe('matchInterestState', () => {
  it('maps liked/mutual flags to none | outgoing | mutual', () => {
    expect(matchInterestState({})).toBe('none');
    expect(matchInterestState({ liked: false, mutual: false })).toBe('none');
    expect(matchInterestState({ liked: true, mutual: false })).toBe('outgoing');
    expect(matchInterestState({ liked: true, mutual: true })).toBe('mutual');
    // Mutual wins even if liked omitted
    expect(matchInterestState({ mutual: true })).toBe('mutual');
  });
});

describe('matchCtaLabel', () => {
  it('shows Match for idle and one-way pending (never Matched / Matched with)', () => {
    expect(matchCtaLabel('none', 'ED')).toBe('Match');
    expect(matchCtaLabel('outgoing', 'ED')).toBe('Match');
    expect(matchCtaLabel('outgoing', 'ED')).not.toMatch(/Matched/i);
  });

  it('shows Matched with {displayName} only when mutual', () => {
    expect(matchCtaLabel('mutual', 'ED')).toBe('Matched with ED');
    expect(matchCtaLabel('mutual', '  Graham  ')).toBe('Matched with Graham');
  });

  it('supports compact mutual labels for grid/search', () => {
    expect(matchCtaLabel('mutual', 'ED', { mutualLabel: 'open_chat' })).toBe('Open chat');
    expect(matchCtaLabel('mutual', 'ED', { mutualLabel: 'chat' })).toBe('Chat');
  });

  it('shows Sending… while in flight', () => {
    expect(matchCtaLabel('none', 'ED', { sending: true })).toBe('Sending…');
  });
});

describe('matchCtaDisabled', () => {
  it('disables one-way pending and in-flight; leaves idle and mutual tappable', () => {
    expect(matchCtaDisabled('none')).toBe(false);
    expect(matchCtaDisabled('outgoing')).toBe(true);
    expect(matchCtaDisabled('mutual')).toBe(false);
    expect(matchCtaDisabled('none', true)).toBe(true);
  });
});

describe('matchCtaAriaLabel', () => {
  it('keeps pending state readable for assistive tech', () => {
    expect(matchCtaAriaLabel('outgoing', 'ED')).toMatch(/already sent/i);
    expect(matchCtaAriaLabel('mutual', 'ED', { mutualOpensChat: true })).toMatch(/Open chat/);
    expect(matchCtaAriaLabel('none', 'ED')).toBe('Match with ED');
  });
});
