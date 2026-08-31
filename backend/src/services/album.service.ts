import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { accessControl, SecurityError } from '../security/access';
import { signedMediaUrl } from '../security/media';
import { computeMediaClear, isDiscreetMediaBlurEnabled, viewerSeesClearMedia } from './discreet-media';

/**
 * Private albums + My Photos library.
 *
 * Free tier: 6 photos total across albums (matches existing premium spec).
 * Paid tier: unlimited.
 *
 * Per-photo visibility (owner discretion): public | view_once | private.
 * View-once blur is per-photo — NOT the global DISCREET_MEDIA_BLUR free-user lock.
 * DISCREET_MEDIA_BLUR stays default-off in beta.
 *
 * Per-viewer grants control who can see locked albums. Owner can grant/revoke.
 * Revoke is VIEWERS ONLY — deletes album_grants rows; never wipes photos or
 * changes visibility/discretion on the owner's album.
 */

export const FREE_PHOTO_CAP = 6;

export type PhotoVisibility = 'public' | 'view_once' | 'private';

export interface AlbumRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_locked: boolean;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  photo_count: number;
  media_clear?: boolean;
}

export interface LibraryPhoto {
  id: string;
  album_id: string;
  photo_url: string;
  visibility: PhotoVisibility;
  position: number;
  created_at: string;
  /** Owner grid: view_once tiles start blurred until opened. */
  media_clear: boolean;
}

export interface AlbumViewer {
  id: string;
  name: string;
  photo_url: string | null;
  granted_at: string;
}

async function resolveViewerPremium(viewerId: string): Promise<boolean> {
  if (!isDiscreetMediaBlurEnabled()) return true;
  return viewerSeesClearMedia(viewerId);
}

function presentCover<T extends { cover_url: string | null; user_id?: string }>(
  row: T,
  viewerId: string,
  viewerIsPremium: boolean,
): T & { media_clear: boolean } {
  const media_clear = computeMediaClear({
    enabled: isDiscreetMediaBlurEnabled(),
    viewerIsPremium,
    isOwnMedia: row.user_id === viewerId,
    mediaType: 'image',
  });
  if (row.cover_url) {
    return {
      ...row,
      cover_url: signedMediaUrl(row.cover_url, viewerId),
      media_clear,
    };
  }
  return { ...row, media_clear };
}

function parseVisibility(raw: unknown): PhotoVisibility {
  if (raw === 'public' || raw === 'view_once' || raw === 'private') return raw;
  return 'private';
}

export const albumService = {
  async createAlbum(
    userId: string,
    data: { name: string; description?: string; is_locked?: boolean }
  ): Promise<AlbumRow> {
    const id = uuidv4();
    const res = await query(
      `INSERT INTO albums (id, user_id, name, description, is_locked)
       VALUES ($1, $2, $3, $4, COALESCE($5, true))
       RETURNING id, user_id, name, description, is_locked, cover_url, created_at, updated_at`,
      [id, userId, data.name.trim(), data.description?.trim() ?? null, data.is_locked ?? true]
    );
    return { ...res.rows[0], photo_count: 0 };
  },

  /** Ensure the owner has a locked Private album to hold private / view_once / public photos. */
  async ensurePrivateAlbum(userId: string): Promise<AlbumRow> {
    const existing = await query(
      `SELECT a.id, a.user_id, a.name, a.description, a.is_locked, a.cover_url,
              a.created_at, a.updated_at,
              COUNT(p.id)::int AS photo_count
         FROM albums a
         LEFT JOIN album_photos p ON p.album_id = a.id
        WHERE a.user_id = $1 AND a.is_locked = true
        GROUP BY a.id
        ORDER BY a.created_at ASC
        LIMIT 1`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return presentCover(existing.rows[0], userId, true);
    }
    return this.createAlbum(userId, { name: 'Private album', is_locked: true });
  },

  async listAlbumsForOwner(userId: string): Promise<AlbumRow[]> {
    const res = await query(
      `SELECT a.id, a.user_id, a.name, a.description, a.is_locked, a.cover_url,
              a.created_at, a.updated_at,
              COUNT(p.id)::int AS photo_count
         FROM albums a
         LEFT JOIN album_photos p ON p.album_id = a.id
        WHERE a.user_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC`,
      [userId]
    );
    // Owner always sees clear media.
    return res.rows.map((row) => presentCover(row, userId, true));
  },

  /**
   * My Photos library for the owner: public tiles, view-once (blurred until opened),
   * private album summary + current viewers. Never invents counts.
   */
  async getOwnerLibrary(userId: string): Promise<{
    public_photos: LibraryPhoto[];
    view_once_photos: LibraryPhoto[];
    private_photos: LibraryPhoto[];
    private_album: AlbumRow | null;
    viewers: AlbumViewer[];
    photo_total: number;
    free_cap: number;
    albums: AlbumRow[];
  }> {
    await this.ensurePrivateAlbum(userId);
    const albums = await this.listAlbumsForOwner(userId);
    const privateAlbum = albums.find((a) => a.is_locked) ?? albums[0] ?? null;

    const photosRes = await query(
      `SELECT id, album_id, photo_url, visibility, position, created_at
         FROM album_photos
        WHERE user_id = $1
        ORDER BY position ASC, created_at ASC`,
      [userId]
    );

    const mapPhoto = (row: {
      id: string;
      album_id: string;
      photo_url: string;
      visibility: string;
      position: number;
      created_at: string;
    }): LibraryPhoto => {
      const visibility = parseVisibility(row.visibility);
      // Owner grid: view_once tiles start blurred (discretion as set). Public/private clear.
      const media_clear = visibility !== 'view_once';
      return {
        id: row.id,
        album_id: row.album_id,
        photo_url: signedMediaUrl(row.photo_url, userId),
        visibility,
        position: row.position,
        created_at: row.created_at,
        media_clear,
      };
    };

    const all = photosRes.rows.map(mapPhoto);
    const public_photos = all.filter((p) => p.visibility === 'public');
    const view_once_photos = all.filter((p) => p.visibility === 'view_once');
    const private_photos = all.filter((p) => p.visibility === 'private');

    const viewers = privateAlbum
      ? await this.listGrantsForOwner(userId, privateAlbum.id)
      : [];

    return {
      public_photos,
      view_once_photos,
      private_photos,
      private_album: privateAlbum,
      viewers,
      photo_total: all.length,
      free_cap: FREE_PHOTO_CAP,
      albums,
    };
  },

  /**
   * Public-facing listing for a viewer looking at someone else's profile.
   * Returns the album metadata + photo_count. The locked flag tells the
   * frontend whether to blur the teaser. Photos themselves require addPhoto/listPhotos.
   */
  async listAlbumsForViewer(ownerId: string, viewerId: string): Promise<Array<AlbumRow & { unlocked: boolean }>> {
    await accessControl.assertProfileView(viewerId, ownerId);
    const viewerIsPremium = await resolveViewerPremium(viewerId);
    const res = await query(
      `SELECT a.id, a.user_id, a.name, a.description, a.is_locked, a.cover_url,
              a.created_at, a.updated_at,
              COUNT(p.id)::int AS photo_count,
              EXISTS (
                SELECT 1 FROM album_grants g
                 WHERE g.album_id = a.id AND g.viewer_id = $2
              ) AS unlocked
         FROM albums a
         LEFT JOIN album_photos p ON p.album_id = a.id
        WHERE a.user_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC`,
      [ownerId, viewerId]
    );
    return res.rows.map((row) => {
      if (row.is_locked && !row.unlocked) {
        return {
          ...row,
          cover_url: null,
          media_clear: computeMediaClear({
            enabled: isDiscreetMediaBlurEnabled(),
            viewerIsPremium,
            isOwnMedia: false,
            mediaType: 'image',
          }),
        };
      }
      return presentCover(row, viewerId, viewerIsPremium);
    });
  },

  async addPhoto(
    userId: string,
    albumId: string,
    storageKey: string,
    mimeType: string,
    visibility: PhotoVisibility = 'private',
  ): Promise<{ id: string; photo_url: string; media_clear: boolean; visibility: PhotoVisibility }> {
    const ownsRes = await query(`SELECT 1 FROM albums WHERE id = $1 AND user_id = $2`, [albumId, userId]);
    if (ownsRes.rows.length === 0) throw new Error('album_not_owned');

    const id = uuidv4();
    const photoUrl = `/api/albums/media/${id}`;
    await query(
      `INSERT INTO album_photos (
         id, album_id, user_id, photo_url, storage_key, mime_type, position, visibility
       )
       VALUES ($1, $2, $3, $4, $5, $6,
         COALESCE((SELECT MAX(position) + 1 FROM album_photos WHERE album_id = $2), 0),
         $7)`,
      [id, albumId, userId, photoUrl, storageKey, mimeType, visibility]
    );

    await query(`UPDATE albums SET updated_at = NOW(), cover_url = COALESCE(cover_url, $2) WHERE id = $1`, [
      albumId,
      photoUrl,
    ]);
    // Owner always clear for their own upload response; view_once tiles blur in library list.
    return {
      id,
      photo_url: signedMediaUrl(photoUrl, userId),
      media_clear: true,
      visibility,
    };
  },

  async listPhotos(
    albumId: string,
    viewerId: string,
    isOwner: boolean
  ): Promise<{
    photos: Array<{
      id: string;
      photo_url: string;
      position: number;
      created_at: string;
      visibility: PhotoVisibility;
      media_clear: boolean;
    }>;
    unlocked: boolean;
    locked: boolean;
    media_clear: boolean;
  }> {
    const albumRes = await query(`SELECT user_id, is_locked FROM albums WHERE id = $1`, [albumId]);
    if (albumRes.rows.length === 0) throw new Error('album_not_found');

    const ownerId = albumRes.rows[0].user_id;
    if (ownerId !== viewerId) {
      await accessControl.assertProfileView(viewerId, ownerId);
    } else {
      await accessControl.requireVerified(viewerId);
    }
    const locked = !!albumRes.rows[0].is_locked;
    const ownerView = isOwner || ownerId === viewerId;

    let unlocked = ownerView || !locked;
    if (!unlocked) {
      const grant = await query(`SELECT 1 FROM album_grants WHERE album_id = $1 AND viewer_id = $2`, [
        albumId,
        viewerId,
      ]);
      unlocked = grant.rows.length > 0;
    }

    if (!unlocked) {
      return { photos: [], unlocked: false, locked: true, media_clear: true };
    }

    const viewerIsPremium = ownerView ? true : await resolveViewerPremium(viewerId);
    const discreetClear = computeMediaClear({
      enabled: isDiscreetMediaBlurEnabled(),
      viewerIsPremium,
      isOwnMedia: ownerView,
      mediaType: 'image',
    });

    const photosRes = await query(
      `SELECT id, photo_url, position, created_at, visibility,
              EXISTS (
                SELECT 1 FROM album_photo_views v
                 WHERE v.photo_id = album_photos.id AND v.viewer_id = $2
              ) AS opened
         FROM album_photos
        WHERE album_id = $1
        ORDER BY position ASC, created_at ASC`,
      [albumId, viewerId]
    );

    return {
      photos: photosRes.rows.map((photo) => {
        const visibility = parseVisibility(photo.visibility);
        // Per-photo view-once: blur until this viewer has opened it.
        // Independent of DISCREET_MEDIA_BLUR (which stays off in beta).
        let media_clear = discreetClear;
        if (visibility === 'view_once' && !ownerView && !photo.opened) {
          media_clear = false;
        }
        if (visibility === 'view_once' && ownerView) {
          // Owner library treats view_once as blurred until they open the tile.
          media_clear = false;
        }
        return {
          id: photo.id,
          photo_url: signedMediaUrl(photo.photo_url, viewerId),
          position: photo.position,
          created_at: photo.created_at,
          visibility,
          media_clear,
        };
      }),
      unlocked: true,
      locked,
      media_clear: discreetClear,
    };
  },

  /** Record a view-once open. Does not delete the owner's photo. */
  async recordPhotoOpen(viewerId: string, photoId: string): Promise<{ opened: boolean; media_clear: boolean }> {
    const media = await this.getMedia(viewerId, photoId);
    const visibilityRes = await query(`SELECT visibility FROM album_photos WHERE id = $1`, [photoId]);
    const visibility = parseVisibility(visibilityRes.rows[0]?.visibility);
    if (visibility !== 'view_once') {
      return { opened: true, media_clear: true };
    }
    if (media.ownerId === viewerId) {
      // Owner preview — no grant consumption; client clears blur locally.
      return { opened: true, media_clear: true };
    }
    await query(
      `INSERT INTO album_photo_views (photo_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [photoId, viewerId]
    );
    return { opened: true, media_clear: true };
  },

  async grantAccess(ownerId: string, albumId: string, viewerId: string): Promise<void> {
    await accessControl.assertInteraction(ownerId, viewerId, { requireMatch: true });
    const ownsRes = await query(`SELECT 1 FROM albums WHERE id = $1 AND user_id = $2`, [albumId, ownerId]);
    if (ownsRes.rows.length === 0) throw new Error('album_not_owned');
    await query(
      `INSERT INTO album_grants (album_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [albumId, viewerId]
    );
  },

  async revokeAccess(ownerId: string, albumId: string, viewerId: string): Promise<void> {
    const ownsRes = await query(`SELECT 1 FROM albums WHERE id = $1 AND user_id = $2`, [albumId, ownerId]);
    if (ownsRes.rows.length === 0) throw new Error('album_not_owned');
    await query(`DELETE FROM album_grants WHERE album_id = $1 AND viewer_id = $2`, [albumId, viewerId]);
  },

  /**
   * Revoke ALL viewers for a locked album. VIEWERS ONLY — never deletes photos,
   * never changes visibility, never unlinks storage. Photos stay on the owner's album.
   */
  async revokeAllAccess(
    ownerId: string,
    albumId: string,
  ): Promise<{ revoked: number; photo_count: number }> {
    const ownsRes = await query(
      `SELECT id FROM albums WHERE id = $1 AND user_id = $2`,
      [albumId, ownerId],
    );
    if (ownsRes.rows.length === 0) throw new Error('album_not_owned');

    const beforePhotos = await query(
      `SELECT COUNT(*)::int AS n FROM album_photos WHERE album_id = $1`,
      [albumId],
    );
    const photoCountBefore = beforePhotos.rows[0]?.n ?? 0;

    const del = await query(
      `DELETE FROM album_grants WHERE album_id = $1 RETURNING viewer_id`,
      [albumId],
    );
    const revoked = del.rowCount ?? del.rows.length;

    const afterPhotos = await query(
      `SELECT COUNT(*)::int AS n FROM album_photos WHERE album_id = $1`,
      [albumId],
    );
    const photoCountAfter = afterPhotos.rows[0]?.n ?? 0;
    if (photoCountAfter !== photoCountBefore) {
      // Defensive lock: revoke must never wipe media.
      throw new Error('revoke_must_not_wipe_media');
    }

    return { revoked, photo_count: photoCountAfter };
  },

  async listGrantsForOwner(ownerId: string, albumId: string): Promise<AlbumViewer[]> {
    const ownsRes = await query(`SELECT 1 FROM albums WHERE id = $1 AND user_id = $2`, [albumId, ownerId]);
    if (ownsRes.rows.length === 0) throw new Error('album_not_owned');
    const res = await query(
      `SELECT u.id, u.name, u.photo_url, g.granted_at
         FROM album_grants g
         JOIN users u ON u.id = g.viewer_id
        WHERE g.album_id = $1
        ORDER BY g.granted_at ASC`,
      [albumId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      photo_url: row.photo_url ? signedMediaUrl(row.photo_url, ownerId) : null,
      granted_at: row.granted_at,
    }));
  },

  async deleteAlbum(userId: string, albumId: string): Promise<void> {
    const res = await query(`DELETE FROM albums WHERE id = $1 AND user_id = $2`, [albumId, userId]);
    if (res.rowCount === 0) throw new Error('album_not_owned');
  },

  async deletePhoto(
    userId: string,
    albumId: string,
    photoId: string,
  ): Promise<{ storage_key: string | null }> {
    const res = await query(
      `SELECT p.storage_key, p.photo_url, a.cover_url
         FROM album_photos p
         JOIN albums a ON a.id = p.album_id
        WHERE p.id = $1 AND p.album_id = $2 AND a.user_id = $3`,
      [photoId, albumId, userId],
    );
    if (res.rows.length === 0) throw new Error('photo_not_found');

    const row = res.rows[0];
    const photoUrl = row.photo_url as string;
    const coverUrl = row.cover_url as string | null;

    await query(`DELETE FROM album_photos WHERE id = $1`, [photoId]);

    if (coverUrl === photoUrl) {
      const nextCover = await query(
        `SELECT photo_url FROM album_photos
          WHERE album_id = $1
          ORDER BY position ASC, created_at ASC
          LIMIT 1`,
        [albumId],
      );
      await query(`UPDATE albums SET cover_url = $2, updated_at = NOW() WHERE id = $1`, [
        albumId,
        nextCover.rows[0]?.photo_url ?? null,
      ]);
    } else {
      await query(`UPDATE albums SET updated_at = NOW() WHERE id = $1`, [albumId]);
    }

    return { storage_key: (row.storage_key as string | null) ?? null };
  },

  async countPhotosForUser(userId: string): Promise<number> {
    const res = await query(`SELECT COUNT(*)::int AS n FROM album_photos WHERE user_id = $1`, [userId]);
    return res.rows[0]?.n ?? 0;
  },

  async getMedia(viewerId: string, photoId: string) {
    const result = await query(
      `SELECT p.storage_key, p.mime_type, p.visibility, a.user_id AS owner_id, a.is_locked,
              EXISTS (
                SELECT 1 FROM album_grants g
                WHERE g.album_id = a.id AND g.viewer_id = $2
              ) AS granted
       FROM album_photos p
       JOIN albums a ON a.id = p.album_id
       WHERE p.id = $1 AND p.storage_key IS NOT NULL`,
      [photoId, viewerId],
    );
    const row = result.rows[0];
    if (!row) throw new SecurityError('media_unavailable', 404, 'Media unavailable');
    if (row.owner_id !== viewerId) {
      await accessControl.assertProfileView(viewerId, row.owner_id);
      if (row.is_locked && !row.granted) {
        throw new SecurityError('media_unavailable', 404, 'Media unavailable');
      }
    } else {
      await accessControl.requireVerified(viewerId);
    }
    return {
      storageKey: row.storage_key as string,
      mimeType: row.mime_type as string,
      ownerId: row.owner_id as string,
      visibility: parseVisibility(row.visibility),
    };
  },

  async viewerMediaClear(viewerId: string, ownerId: string): Promise<boolean> {
    const viewerIsPremium = await resolveViewerPremium(viewerId);
    return computeMediaClear({
      enabled: isDiscreetMediaBlurEnabled(),
      viewerIsPremium,
      isOwnMedia: viewerId === ownerId,
      mediaType: 'image',
    });
  },
};
