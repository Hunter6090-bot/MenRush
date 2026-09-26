import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getActiveMention, applyMentionReplacement } from './mentions.ts';

describe('mentions utility', () => {
  describe('getActiveMention', () => {
    it('returns null when text does not contain @', () => {
      assert.equal(getActiveMention('hello world', 5), null);
    });

    it('returns null when cursor is before @', () => {
      assert.equal(getActiveMention('meet me @Tropics', 5), null);
    });

    it('detects @ at start of input', () => {
      const match = getActiveMention('@', 1);
      assert.deepEqual(match, {
        query: '',
        startIndex: 0,
        endIndex: 1,
      });
    });

    it('detects @ followed by partial query', () => {
      const match = getActiveMention('Heading to @Trop', 16);
      assert.deepEqual(match, {
        query: 'Trop',
        startIndex: 11,
        endIndex: 16,
      });
    });

    it('returns null if @ is preceded by a non-whitespace character (e.g. email)', () => {
      assert.equal(getActiveMention('user@domain.com', 8), null);
    });

    it('returns null if query contains newline', () => {
      assert.equal(getActiveMention('@hello\nworld', 10), null);
    });

    it('returns null if query candidate exceeds 30 characters', () => {
      const longQuery = '@' + 'a'.repeat(35);
      assert.equal(getActiveMention(longQuery, longQuery.length), null);
    });
  });

  describe('applyMentionReplacement', () => {
    it('replaces active mention with formatted @Name and trailing space', () => {
      const { newText, newCursorPos } = applyMentionReplacement(
        'Heading to @Trop tonight',
        11,
        16,
        'Tropics Day Spa',
      );
      assert.equal(newText, 'Heading to @Tropics Day Spa  tonight');
      assert.equal(newCursorPos, 11 + '@Tropics Day Spa '.length);
    });

    it('strips redundant leading @ from mention name', () => {
      const { newText } = applyMentionReplacement(
        '@',
        0,
        1,
        '@Alex',
      );
      assert.equal(newText, '@Alex ');
    });

    it('enforces max length when inserting mention', () => {
      const base = 'a'.repeat(270) + ' @Tr';
      const { newText } = applyMentionReplacement(
        base,
        271,
        base.length,
        'Tropics Day Spa',
        280,
      );
      assert.equal(newText.length <= 280, true);
    });
  });
});
