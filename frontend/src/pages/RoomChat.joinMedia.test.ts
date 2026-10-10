/** RoomChat hands the join screen's Camera / Mic choice to the existing room media hook. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, 'RoomChat.tsx'), 'utf8');

describe('RoomChat join media wiring', () => {
  it('starts with both off and passes the choice to useRoomVideo', () => {
    expect(src).toMatch(/useState<RoomMediaChoice>\(ROOM_MEDIA_OFF\)/);
    expect(src).toMatch(/initialMedia: joinMedia/);
    expect(src).toMatch(/onMediaChoiceChange=\{setJoinMedia\}/);
  });

  it('identity payload handling is untouched: onReady still receives only the identity', () => {
    expect(src).toMatch(/onReady=\{async \(choice\) => \{/);
  });

  it('in-room media notes are plain 15px', () => {
    expect(src).toMatch(/data-testid="room-video-note"/);
    const block = src.slice(src.indexOf('{videoError && ('), src.indexOf('data-testid="room-video-note"'));
    expect(block).toContain('text-[15px]');
  });
});
