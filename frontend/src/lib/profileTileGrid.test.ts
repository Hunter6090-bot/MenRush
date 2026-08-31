import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROFILE_TILE_GRID_CLASS } from './profileTileGrid.ts';

describe('PROFILE_TILE_GRID_CLASS', () => {
  it('uses three columns on phone (<768px)', () => {
    assert.match(PROFILE_TILE_GRID_CLASS, /\bgrid-cols-3\b/);
    assert.doesNotMatch(PROFILE_TILE_GRID_CLASS, /\bgrid-cols-2\b/);
  });

  it('keeps tablet md+ auto-fill (not two giant iPad squares)', () => {
    assert.match(
      PROFILE_TILE_GRID_CLASS,
      /md:grid-cols-\[repeat\(auto-fill,minmax\(140px,1fr\)\)\]/,
    );
  });

  it('keeps desktop lg+ auto-fill spirit', () => {
    assert.match(
      PROFILE_TILE_GRID_CLASS,
      /lg:grid-cols-\[repeat\(auto-fill,minmax\(150px,1fr\)\)\]/,
    );
  });
});
