/**
 * Chat attach picker — Public + View once default; private only if opened+picked.
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { MyPhotosLibraryDTO } from '../api/client';
import {
  buildAttachPickerModel,
  defaultGridIncludesPrivate,
  mergeAttachSelection,
} from './chatAttachLibrary';

function library(partial: Partial<MyPhotosLibraryDTO> = {}): MyPhotosLibraryDTO {
  return {
    public_photos: [],
    view_once_photos: [],
    private_photos: [],
    private_album: {
      id: 'alb-private',
      user_id: 'u1',
      name: 'Private',
      description: null,
      is_locked: true,
      cover_url: null,
      photo_count: 0,
      created_at: '',
      updated_at: '',
    },
    viewers: [],
    photo_total: 0,
    free_cap: 6,
    albums: [
      {
        id: 'alb-private',
        user_id: 'u1',
        name: 'Private',
        description: null,
        is_locked: true,
        cover_url: null,
        photo_count: 0,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'alb-trips',
        user_id: 'u1',
        name: 'Trips',
        description: null,
        is_locked: false,
        cover_url: null,
        photo_count: 0,
        created_at: '',
        updated_at: '',
      },
    ],
    ...partial,
  };
}

const photo = (
  id: string,
  visibility: 'public' | 'view_once' | 'private',
  album_id = 'alb-private',
) => ({
  id,
  album_id,
  photo_url: `/api/albums/media/${id}`,
  visibility,
  position: 0,
  created_at: '',
  media_clear: visibility !== 'view_once',
});

describe('buildAttachPickerModel', () => {
  it('default grid lists public + view_once only, grouped by album', () => {
    const model = buildAttachPickerModel(
      library({
        public_photos: [photo('p1', 'public', 'alb-trips'), photo('p2', 'public')],
        view_once_photos: [photo('v1', 'view_once')],
        private_photos: [photo('x1', 'private'), photo('x2', 'private')],
      }),
    );

    expect(model.defaultPhotoIds).toEqual(['p1', 'p2', 'v1']);
    expect(model.privatePhotoIds).toEqual(['x1', 'x2']);
    expect(defaultGridIncludesPrivate(model)).toBe(false);

    const flatDefault = model.defaultSections.flatMap((s) => s.photos.map((p) => p.id));
    expect(flatDefault).toEqual(['p1', 'p2', 'v1']);
    expect(flatDefault).not.toContain('x1');

    expect(model.defaultSections.map((s) => s.name)).toContain('Trips');
    expect(model.privateSection?.count).toBe(2);
    expect(model.privateSection?.photos.map((p) => p.id)).toEqual(['x1', 'x2']);
  });

  it('private photos are not in default sections even when alone in library', () => {
    const model = buildAttachPickerModel(
      library({
        private_photos: [photo('priv1', 'private')],
      }),
    );
    expect(model.defaultSections).toEqual([]);
    expect(model.defaultPhotoIds).toEqual([]);
    expect(model.privateSection?.photos).toHaveLength(1);
  });
});

describe('mergeAttachSelection discretion', () => {
  it('blocks private selection when private section is closed', () => {
    expect(
      mergeAttachSelection([], 'priv1', { isPrivate: true, privateSectionOpen: false }),
    ).toEqual([]);
  });

  it('allows picking one private photo when section is open', () => {
    expect(
      mergeAttachSelection(['p1'], 'priv1', { isPrivate: true, privateSectionOpen: true }),
    ).toEqual(['p1', 'priv1']);
  });

  it('toggles off a selected private photo', () => {
    expect(
      mergeAttachSelection(['priv1'], 'priv1', { isPrivate: true, privateSectionOpen: true }),
    ).toEqual([]);
  });

  it('always allows public / view_once toggles', () => {
    expect(
      mergeAttachSelection([], 'pub1', { isPrivate: false, privateSectionOpen: false }),
    ).toEqual(['pub1']);
  });
});
