/**
 * Chat attach picker — My Photos albums + contents.
 *
 * Discretion lock:
 * - Default grid = Public + View once only (and albums that contain them).
 * - Private stays private unless the owner opens Private and taps a photo.
 * - Never auto-select private photos. Never dump a private album into a message.
 */
import type { AlbumDTO, LibraryPhotoDTO, MyPhotosLibraryDTO } from '../api/client';

export type AttachPickerAlbumSection = {
  kind: 'album';
  albumId: string;
  name: string;
  photos: LibraryPhotoDTO[];
};

export type AttachPickerPrivateSection = {
  kind: 'private';
  albumId: string | null;
  name: string;
  photos: LibraryPhotoDTO[];
  count: number;
};

export type AttachPickerModel = {
  /** Albums with public / view_once photos only — never includes private photos. */
  defaultSections: AttachPickerAlbumSection[];
  /** Private photos live only here; sheet starts collapsed. */
  privateSection: AttachPickerPrivateSection | null;
  /** Flat default grid ids (public + view_once) for tests / quick checks. */
  defaultPhotoIds: string[];
  privatePhotoIds: string[];
};

function albumName(albumsById: Map<string, AlbumDTO>, albumId: string): string {
  const album = albumsById.get(albumId);
  if (!album) return 'Album';
  if (album.is_locked) return album.name?.trim() || 'Private album';
  return album.name?.trim() || 'Album';
}

function groupByAlbum(
  photos: LibraryPhotoDTO[],
  albumsById: Map<string, AlbumDTO>,
): AttachPickerAlbumSection[] {
  const order: string[] = [];
  const buckets = new Map<string, LibraryPhotoDTO[]>();
  for (const photo of photos) {
    if (!buckets.has(photo.album_id)) {
      buckets.set(photo.album_id, []);
      order.push(photo.album_id);
    }
    buckets.get(photo.album_id)!.push(photo);
  }
  return order.map((albumId) => ({
    kind: 'album' as const,
    albumId,
    name: albumName(albumsById, albumId),
    photos: buckets.get(albumId)!,
  }));
}

/** Build attach sheet sections from GET /albums/mine. Pure — no network. */
export function buildAttachPickerModel(library: MyPhotosLibraryDTO): AttachPickerModel {
  const albumsById = new Map((library.albums ?? []).map((a) => [a.id, a]));
  const publicPhotos = library.public_photos ?? [];
  const viewOncePhotos = library.view_once_photos ?? [];
  const privatePhotos = library.private_photos ?? [];

  const defaultPhotos = [...publicPhotos, ...viewOncePhotos];
  const defaultSections = groupByAlbum(defaultPhotos, albumsById);

  const privateAlbum = library.private_album;
  const privateSection: AttachPickerPrivateSection | null =
    privatePhotos.length > 0 || privateAlbum
      ? {
          kind: 'private',
          albumId: privateAlbum?.id ?? privatePhotos[0]?.album_id ?? null,
          name: privateAlbum?.name?.trim() || 'Private',
          photos: privatePhotos,
          count: privatePhotos.length,
        }
      : null;

  return {
    defaultSections,
    privateSection,
    defaultPhotoIds: defaultPhotos.map((p) => p.id),
    privatePhotoIds: privatePhotos.map((p) => p.id),
  };
}

/** Default grid never includes private photo ids. */
export function defaultGridIncludesPrivate(model: AttachPickerModel): boolean {
  const defaultSet = new Set(model.defaultPhotoIds);
  return model.privatePhotoIds.some((id) => defaultSet.has(id));
}

/**
 * Selecting photos for attach — private ids are only allowed when the caller
 * explicitly includes them (owner opened Private and tapped).
 */
export function mergeAttachSelection(
  current: string[],
  photoId: string,
  opts: { isPrivate: boolean; privateSectionOpen: boolean },
): string[] {
  if (opts.isPrivate && !opts.privateSectionOpen) {
    return current;
  }
  if (current.includes(photoId)) {
    return current.filter((id) => id !== photoId);
  }
  return [...current, photoId];
}
