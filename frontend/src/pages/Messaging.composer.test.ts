/** Board state 07 (Zoul, 10 Oct 2026): the chat box placeholder is "Message". */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('chat composer matches the board', () => {
  it('placeholder is Message', () => {
    const src = readFileSync(resolve(__dirname, 'Messaging.tsx'), 'utf8');
    const input = src.match(/<input[^>]*data-testid="chat-text-input"/s)?.[0] ?? '';
    expect(input).toContain('placeholder="Message"');
    expect(src).not.toContain('Say something direct.');
  });
});
