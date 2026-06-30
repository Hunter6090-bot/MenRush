import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { accessControl, SecurityError } from '../security/access';
import { isExhaustedMedia, resolveMediaPath, signedMediaUrl } from '../security/media';
import type { MediaKind, MessageMediaKind } from '../types/validation';
import { MISSED_CALL_MESSAGE, MISSED_CALL_PREVIEW } from '../constants/missedCall';

/**
 * Disappearing images use a view-count model (see migration 010):
 *   max_views  NULL  -> permanent (kept in the conversation)
 *              N>=1  -> disappearing, allows N recipient views
 *   view_count       -> views the recipient has actually consumed. A view is
 *                       only consumed once the image has loaded and been shown
 *                       (the client calls `markMessageViewed` after onload).
 * Once view_count >= max_views the image is "exhausted": the media endpoint
 * stops serving it and the read path scrubs it to a tombstone.
 */

interface ConversationRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  media_type: MessageMediaKind | null;
  media_url: string | null;
  media_storage_key?: string | null;
  media_mime_type?: string | null;
  audio_duration_ms: number | null;
  is_disappearing: boolean;
  expires_at: string | null;
  viewed_at: string | null;
  max_views: number | null;
  view_count: number;
  remaining_views?: number | null;
  expired: boolean;
  withdrawn_at?: string | null;
}

const mediaDir = path.resolve(__dirname, '../../uploads/messages');

/** Columns returned for every message row sent to the client. */
const MESSAGE_COLUMNS = `id, sender_id, receiver_id, message, created_at,
                 media_type, media_url, audio_duration_ms,
                 is_disappearing, expires_at, viewed_at, max_views, view_count, withdrawn_at`;

/** Strip exhausted disappearing media from a row before sending to the client. */
function scrubExpired<T extends ConversationRow>(row: T): T {
  if (row.withdrawn_at) {
    const label =
      row.media_type === 'audio' ? 'Voice note withdrawn' : 'Photo withdrawn';
    return {
      ...row,
      media_url: null,
      message: label,
      remaining_views: 0,
      expired: true,
    };
  }
  const remaining =
    row.is_disappearing && row.max_views != null
      ? Math.max(0, row.max_views - (row.view_count ?? 0))
      : null;
  if (!isExhaustedMedia(row.is_disappearing, row.max_views, row.view_count)) {
    return { ...row, remaining_views: remaining, expired: false };
  }
  return {
    ...row,
    media_url: null,
    message: row.media_type
      ? `(${row.media_type === 'image' ? 'photo' : 'voice note'} no longer available)`
      : '(message expired)',
    remaining_views: 0,
    expired: true,
  };
}

function presentMessage<T extends ConversationRow>(row: T, viewerId: string): T {
  const scrubbed = scrubExpired(row);
  if (scrubbed.media_url) {
    const mediaPath = scrubbed.media_url.split('?', 1)[0];
    return {
      ...scrubbed,
      media_url: signedMediaUrl(mediaPath, viewerId),
      media_storage_key: undefined,
      media_mime_type: undefined,
    };
  }
  return { ...scrubbed, media_storage_key: undefined, media_mime_type: undefined };
}

async function attachSenderName<T extends { sender_id: string }>(
  row: T & Partial<{ sender_name: string }>
): Promise<T & { sender_name?: string }> {
  const r = await query(`SELECT name FROM users WHERE id = $1`, [row.sender_id]);
  if (r.rows[0]) row.sender_name = r.rows[0].name;
  return row;
}

export const messageService = {
  forViewer<T extends ConversationRow>(message: T, viewerId: string): T {
    return presentMessage(message, viewerId);
  },

  async sendMessage(senderId: string, receiverId: string, message: string) {
    await accessControl.assertInteraction(senderId, receiverId, { requireMatch: true });

    const id = uuidv4();
    const sanitized = message.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();

    const result = await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING ${MESSAGE_COLUMNS}`,
      [id, senderId, receiverId, sanitized]
    );

    return attachSenderName(presentMessage(result.rows[0] as ConversationRow, senderId));
  },

  /** Call log row when a video call rings out without being answered. */
  async recordMissedCall(callerId: string, calleeId: string) {
    await accessControl.assertInteraction(callerId, calleeId, { requireMatch: true });

    const id = uuidv4();
    const result = await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at, read)
       VALUES ($1, $2, $3, $4, NOW(), false)
       RETURNING ${MESSAGE_COLUMNS}`,
      [id, callerId, calleeId, MISSED_CALL_MESSAGE],
    );

    return attachSenderName(result.rows[0] as ConversationRow);
  },

  async sendLocationMessage(
    senderId: string,
    receiverId: string,
    coords: { lat: number; lng: number },
  ) {
    await accessControl.assertInteraction(senderId, receiverId, { requireMatch: true });

    const id = uuidv4();
    const payload = JSON.stringify({
      lat: coords.lat,
      lng: coords.lng,
    });

    const result = await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at, media_type)
       VALUES ($1, $2, $3, $4, NOW(), 'location')
       RETURNING ${MESSAGE_COLUMNS}`,
      [id, senderId, receiverId, payload],
    );

    return attachSenderName(presentMessage(result.rows[0] as ConversationRow, senderId));
  },

  async sendMediaMessage(
    senderId: string,
    receiverId: string,
    opts: {
      mediaType: MediaKind;
      storageKey: string;
      mimeType: string;
      caption?: string;
      disappearing?: boolean;
      maxViews?: number;
      audioDurationMs?: number;
    }
  ) {
    await accessControl.assertInteraction(senderId, receiverId, { requireMatch: true });

    const id = uuidv4();
    const caption = (opts.caption ?? '').replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
    // Default body — UI uses this if media fails to load.
    const fallbackBody = caption || (opts.mediaType === 'image' ? '📷 Photo' : '🎤 Voice note');
    // Only images can be disappearing. A disappearing image is view-limited:
    // max_views defaults to 1 ("view once") when the sender didn't specify.
    const isDisappearing = opts.mediaType === 'image' && opts.disappearing === true;
    const maxViews = isDisappearing
      ? Math.min(99, Math.max(1, Math.floor(opts.maxViews ?? 1)))
      : null;

    const result = await query(
      `INSERT INTO messages (
         id, sender_id, receiver_id, message, created_at,
         media_type, media_url, media_storage_key, media_mime_type,
         audio_duration_ms, is_disappearing, max_views, view_count
       )
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11, 0)
       RETURNING ${MESSAGE_COLUMNS}`,
      [
        id,
        senderId,
        receiverId,
        fallbackBody,
        opts.mediaType,
        `/api/messages/${id}/media`,
        opts.storageKey,
        opts.mimeType,
        opts.mediaType === 'audio' ? opts.audioDurationMs ?? null : null,
        isDisappearing,
        maxViews,
      ]
    );

    return attachSenderName(presentMessage(result.rows[0] as ConversationRow, senderId));
  },

  /**
   * Recipient consumes one view of a disappearing image. Called by the client
   * only AFTER the image has loaded and become visible — so a failed load or a
   * mere tap never burns a view. The increment is atomic and capped at
   * max_views, which keeps duplicate taps, refreshes, reconnects and multiple
   * devices from over-counting. Idempotent for already-exhausted media.
   * Returns the updated (and scrubbed-if-exhausted) message row.
   */
  async markMessageViewed(viewerId: string, messageId: string) {
    const existing = await query(
      `SELECT sender_id, is_disappearing, max_views, view_count
         FROM messages WHERE id = $1 AND receiver_id = $2`,
      [messageId, viewerId],
    );
    if (!existing.rows[0]) throw new Error('message_not_found_or_not_recipient');
    await accessControl.assertInteraction(viewerId, existing.rows[0].sender_id, { requireMatch: true });

    // Atomically consume a view, but never exceed max_views. Permanent or
    // non-image media isn't view-limited, so we only stamp viewed_at.
    const result = await query(
      `UPDATE messages
          SET viewed_at = COALESCE(viewed_at, NOW()),
              view_count = CASE
                WHEN is_disappearing AND max_views IS NOT NULL AND view_count < max_views
                  THEN view_count + 1
                ELSE view_count
              END
        WHERE id = $1
          AND receiver_id = $2
        RETURNING ${MESSAGE_COLUMNS}`,
      [messageId, viewerId]
    );

    if (result.rows.length === 0) {
      throw new Error('message_not_found_or_not_recipient');
    }
    return presentMessage(result.rows[0] as ConversationRow, viewerId);
  },

  /** Sender withdraws media from the chat — scrubs for both parties. */
  async withdrawMedia(senderId: string, messageId: string) {
    const existing = await query(
      `SELECT sender_id, receiver_id, media_storage_key, media_type, withdrawn_at
       FROM messages WHERE id = $1`,
      [messageId],
    );
    const row = existing.rows[0];
    if (!row || row.sender_id !== senderId) {
      throw new Error('not_sender_or_not_found');
    }
    if (row.withdrawn_at) {
      throw new Error('already_withdrawn');
    }
    if (!row.media_storage_key) {
      throw new Error('not_media');
    }

    try {
      fs.unlinkSync(resolveMediaPath(mediaDir, row.media_storage_key as string));
    } catch {
      /* file may already be gone */
    }

    const label = row.media_type === 'audio' ? 'Voice note withdrawn' : 'Photo withdrawn';
    const result = await query(
      `UPDATE messages SET
         media_url = NULL,
         media_storage_key = NULL,
         media_mime_type = NULL,
         withdrawn_at = NOW(),
         message = $3
       WHERE id = $1 AND sender_id = $2
       RETURNING ${MESSAGE_COLUMNS}`,
      [messageId, senderId, label],
    );

    const updated = result.rows[0] as ConversationRow;
    const forSender = presentMessage(updated, senderId);
    const forReceiver = presentMessage(updated, row.receiver_id as string);
    return { forSender, forReceiver, receiverId: row.receiver_id as string };
  },

  async getConversation(userId: string, otherId: string, limit: number = 50) {
    await accessControl.assertInteraction(userId, otherId, { requireMatch: true });
    const result = await query(
      `SELECT ${MESSAGE_COLUMNS}
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, otherId, limit]
    );

    await query(
      `UPDATE messages SET read = true
       WHERE receiver_id = $1 AND sender_id = $2 AND read = false`,
      [userId, otherId],
    );

    return result.rows.reverse().map((r) => presentMessage(r as ConversationRow, userId));
  },

  async getUnreadSummary(userId: string) {
    await accessControl.requireVerified(userId);
    const result = await query(
      `SELECT sender_id, COUNT(*)::int AS count
       FROM messages
       WHERE receiver_id = $1 AND read = false
       GROUP BY sender_id`,
      [userId],
    );
    const bySender: Record<string, number> = {};
    let total = 0;
    for (const row of result.rows) {
      bySender[row.sender_id as string] = row.count as number;
      total += row.count as number;
    }
    return { total, bySender };
  },

  async getConversations(userId: string) {
    await accessControl.requireVerified(userId);
    const result = await query(
      `SELECT
        other_user_id,
        other_user_name,
        last_message_time,
        last_message,
        photo_url,
        online,
        unread_count
       FROM (
         SELECT DISTINCT ON (
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
         )
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
           u.name AS other_user_name,
           m.created_at AS last_message_time,
           CASE WHEN m.message = $2 THEN $3 ELSE m.message END AS last_message,
           u.photo_url,
           COALESCE(p.online, false) AS online,
           (
             SELECT COUNT(*)::int
             FROM messages um
             WHERE um.receiver_id = $1
               AND um.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
               AND um.read = false
           ) AS unread_count
         FROM messages m
         JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE (m.sender_id = $1 OR m.receiver_id = $1)
           AND u.is_verified = TRUE
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = $1)
           )
         ORDER BY
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END,
           m.created_at DESC
       ) sub
       ORDER BY last_message_time DESC`,
      [userId, MISSED_CALL_MESSAGE, MISSED_CALL_PREVIEW]
    );

    return result.rows;
  },

  async getMedia(viewerId: string, messageId: string) {
    const result = await query(
      `SELECT id, sender_id, receiver_id, media_storage_key, media_mime_type,
              is_disappearing, max_views, view_count, withdrawn_at
       FROM messages
       WHERE id = $1 AND media_storage_key IS NOT NULL`,
      [messageId],
    );
    const row = result.rows[0];
    if (!row || (row.sender_id !== viewerId && row.receiver_id !== viewerId)) {
      throw new SecurityError('media_unavailable', 404, 'Media unavailable');
    }
    if (row.withdrawn_at) {
      throw new SecurityError('media_withdrawn', 410, 'Media withdrawn');
    }
    const otherId = row.sender_id === viewerId ? row.receiver_id : row.sender_id;
    await accessControl.assertInteraction(viewerId, otherId, { requireMatch: true });
    if (isExhaustedMedia(row.is_disappearing, row.max_views, row.view_count)) {
      throw new SecurityError('media_expired', 410, 'Media expired');
    }
    return {
      storageKey: row.media_storage_key as string,
      mimeType: row.media_mime_type as string,
    };
  },
};
