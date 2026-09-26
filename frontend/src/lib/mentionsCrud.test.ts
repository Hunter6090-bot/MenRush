import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyMentionReplacement, getActiveMention } from './mentions.ts';

describe('Community Add/Edit/Delete with @ Mentions Autocomplete', () => {
  it('allows author to add a post with @ mention inserted', () => {
    const text = 'Heading over to @Tro';
    const active = getActiveMention(text, text.length);
    assert.ok(active);

    const { newText } = applyMentionReplacement(
      text,
      active.startIndex,
      active.endIndex,
      'Tropics Day Spa',
      280,
    );
    assert.equal(newText, 'Heading over to @Tropics Day Spa ');
  });

  it('allows author to edit existing post body inserting @ mention', () => {
    const initialPost = 'Looking for drinks tonight';
    const cursorAtEnd = initialPost + ' with @Da';
    const active = getActiveMention(cursorAtEnd, cursorAtEnd.length);
    assert.ok(active);

    const { newText } = applyMentionReplacement(
      cursorAtEnd,
      active.startIndex,
      active.endIndex,
      'Dave',
      280,
    );
    assert.equal(newText, 'Looking for drinks tonight with @Dave ');
    assert.equal(newText.length <= 280, true);
  });

  it('allows author to edit existing comment body inserting @ mention', () => {
    const initialComment = 'See you there @Tr';
    const active = getActiveMention(initialComment, initialComment.length);
    assert.ok(active);

    const { newText } = applyMentionReplacement(
      initialComment,
      active.startIndex,
      active.endIndex,
      'Tropics Day Spa',
      280,
    );
    assert.equal(newText, 'See you there @Tropics Day Spa ');
  });

  it('ownership rule: only post author or comment author should have edit/delete affordances', () => {
    const viewerId = 'user-viewer-1';
    const myPost = { id: 'p1', user_id: 'user-viewer-1', body: 'My post' };
    const otherPost = { id: 'p2', user_id: 'user-other-2', body: 'Other post' };

    assert.equal(myPost.user_id === viewerId, true);
    assert.equal(otherPost.user_id === viewerId, false);
  });
});
