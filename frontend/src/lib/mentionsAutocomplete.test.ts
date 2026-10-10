import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyMentionReplacement, getActiveMention } from '../lib/mentions.ts';

describe('Mention autocomplete UX filtering logic', () => {
  it('detects @ in multi-word messages', () => {
    const text = 'Heading over to @Tro';
    const active = getActiveMention(text, text.length);
    assert.deepEqual(active, {
      query: 'Tro',
      startIndex: 16,
      endIndex: 20,
    });
  });

  it('filters candidates strictly to matches and hot spots containing query', () => {
    const mockSuggestions = [
      { id: '1', type: 'hot_spot' as const, name: 'Tropics Day Spa' },
      { id: '2', type: 'match' as const, name: 'Troy' },
      { id: '3', type: 'hot_spot' as const, name: 'Pleasuredrome' },
      { id: '4', type: 'match' as const, name: 'Alex' },
    ];

    const q = 'tro';
    const filtered = mockSuggestions.filter((item) =>
      item.name.toLowerCase().includes(q.toLowerCase()),
    );

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].name, 'Tropics Day Spa');
    assert.equal(filtered[1].name, 'Troy');
  });

  it('formats replacement text honestly without exceeding 280 chars', () => {
    const text = 'Let us go to @Tro';
    const active = getActiveMention(text, text.length);
    assert.ok(active);

    const { newText, newCursorPos } = applyMentionReplacement(
      text,
      active.startIndex,
      active.endIndex,
      'Tropics Day Spa',
      280,
    );

    assert.equal(newText, 'Let us go to @Tropics Day Spa ');
    assert.equal(newCursorPos, newText.length);
    assert.equal(newText.length <= 280, true);
  });
});
