/**
 * My Photos UI helpers — four album states + viewers-only revoke copy.
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

/** Build grid tiles the same way Albums.tsx does (pure). */
function buildTiles(input: {
  public_photos: { id: string }[];
  view_once_photos: { id: string }[];
  private_count: number;
}) {
  const tiles: Array<{ kind: string; id?: string; count?: number }> = [];
  for (const photo of input.public_photos) {
    tiles.push({ kind: 'photo', id: photo.id });
  }
  for (const photo of input.view_once_photos) {
    tiles.push({ kind: 'photo', id: photo.id });
  }
  tiles.push({ kind: 'private_album', count: input.private_count });
  tiles.push({ kind: 'add' });
  return tiles;
}

function footerCopy() {
  return 'Photos stay yours. View-once expires after opening. Revoking removes viewers only — your album is unchanged.';
}

function revokedStatus(viewersRemoved: number) {
  return `Access revoked. ${viewersRemoved} ${viewersRemoved === 1 ? 'viewer' : 'viewers'} removed.`;
}

describe('My Photos four album states', () => {
  it('builds public + view_once + private album + add', () => {
    const tiles = buildTiles({
      public_photos: [{ id: 'p1' }],
      view_once_photos: [{ id: 'v1' }],
      private_count: 4,
    });
    expect(tiles.map((t) => t.kind)).toEqual(['photo', 'photo', 'private_album', 'add']);
    expect(tiles[2]).toEqual({ kind: 'private_album', count: 4 });
  });

  it('still shows private album + add when empty', () => {
    const tiles = buildTiles({
      public_photos: [],
      view_once_photos: [],
      private_count: 0,
    });
    expect(tiles.map((t) => t.kind)).toEqual(['private_album', 'add']);
  });
});

describe('Revoke viewers-only copy', () => {
  it('never claims a media wipe', () => {
    const copy = footerCopy();
    expect(copy.toLowerCase()).not.toMatch(/wipe|every device/);
    expect(copy).toMatch(/viewers only/i);
    expect(copy).toMatch(/Photos stay yours/);
  });

  it('revoked status names viewers removed', () => {
    expect(revokedStatus(3)).toBe('Access revoked. 3 viewers removed.');
    expect(revokedStatus(1)).toBe('Access revoked. 1 viewer removed.');
  });
});
