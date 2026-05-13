import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Private albums.
 *
 * Free tier: 6 photos total across albums (matches existing premium spec).
 * Paid tier: unlimited.
 *
 * Per-viewer grants control who can see each album. Owner can grant/revoke.
 */

export const FREE_PHOTO_CAP = 6;

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
    return res.rows;
  },

  /**
   * Public-facing listing for a viewer looking at someone else's profile.
   * Returns the album metadata + photo_count. The locked flag tells the
   * frontend whether to blur the teaser. Photos themselves require addPhoto/listPhotos.
   */
  async listAlbumsForViewer(ownerId: string, viewerId: string): Promise<Array<AlbumRow & { unlocked: boolean }>> {
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
    return res.rows;
  },

  async addPhoto(userId: string, albumId: string, photoUrl: string): Promise<void> {
    const ownsRes = await query(`SELECT 1 FROM albums WHERE id = $1 AND user_id = $2`, [albumId, userId]);
    if (ownsRes.rows.length === 0) throw new Error('album_not_owned');

    const id = uuidv4();
    await query(
      `INSERT INTO album_photos (id, album_id, user_id, photo_url, position)
       VALUES ($1, $2, $3, $4,
         COALESCE((SELECT MAX(position) + 1 FROM album_photos WHERE album_id = $2), 0))`,
      [id, albumId, userId, photoUrl]
    );

    await query(`UPDATE albums SET updated_at = NOW(), cover_url = COALESCE(cover_url, $2) WHERE id = $1`, [
      albumId,
      photoUrl,
    ]);
  },

  async listPhotos(
    albumId: string,
    viewerId: string,
    isOwner: boolean
  ): Promise<{ photos: Array<{ id: string; photo_url: string; position: number; created_at: string }>; unlocked: boolean; locked: boolean }> {
    const albumRes = await query(`SELECT user_id, is_locked FROM albums WHERE id = $1`, [albumId]);
    if (albumRes.rows.length === 0) throw new Error('album_not_found');

    const ownerId = albumRes.rows[0].user_id;
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
      return { photos: [], unlocked: false, locked: true };
    }

    const photosRes = await query(
      `SELECT id, photo_url, position, created_at
         FROM album_photos
        WHERE album_id = $1
        ORDER BY position ASC, created_at ASC`,
      [albumId]
    );

    return { photos: photosRes.rows, unlocked: true, locked };
  },

  async grantAccess(ownerId: string, albumId: string, viewerId: string): Promise<void> {
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

  async deleteAlbum(userId: string, albumId: string): Promise<void> {
    const res = await query(`DELETE FROM albums WHERE id = $1 AND user_id = $2`, [albumId, userId]);
    if (res.rowCount === 0) throw new Error('album_not_owned');
  },

  async countPhotosForUser(userId: string): Promise<number> {
    const res = await query(`SELECT COUNT(*)::int AS n FROM album_photos WHERE user_id = $1`, [userId]);
    return res.rows[0]?.n ?? 0;
  },
};
