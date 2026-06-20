import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { accessControl, SecurityError } from '../security/access';
import { isExpiredMedia, signedMediaUrl } from '../security/media';
import type { MediaKind } from '../types/validation';

/**
 * Disappearing messages burn 10s after the recipient first views them
 * (image opened, audio played). `viewed_at` is set on view; `expires_at`
 * is set to viewed_at + DISAPPEAR_WINDOW_MS. After that, the read path
 * scrubs media_url and replaces the message body with a tombstone.
 */
const DISAPPEAR_WINDOW_MS = 10_000;

interface ConversationRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  media_type: MediaKind | null;
  media_url: string | null;
  media_storage_key?: string | null;
  media_mime_type?: string | null;
  audio_duration_ms: number | null;
  is_disappearing: boolean;
  expires_at: string | null;
  viewed_at: string | null;
  expired: boolean;
}

/** Strip burned media from a row before sending to the client. */
function scrubExpired<T extends ConversationRow>(row: T): T {
  if (!row.is_disappearing || !row.expires_at) return { ...row, expired: false };
  const expired = Date.parse(row.expires_at) <= Date.now();
  if (!expired) return { ...row, expired: false };
  return {
    ...row,
    media_url: null,
    message: row.media_type ? `(${row.media_type === 'image' ? 'photo' : 'voice note'} burned)` : '(message expired)',
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
       RETURNING id, sender_id, receiver_id, message, created_at,
                 media_type, media_url, audio_duration_ms,
                 is_disappearing, expires_at, viewed_at`,
      [id, senderId, receiverId, sanitized]
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
      audioDurationMs?: number;
    }
  ) {
    await accessControl.assertInteraction(senderId, receiverId, { requireMatch: true });

    const id = uuidv4();
    const caption = (opts.caption ?? '').replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
    // Default body — UI uses this if media fails to load.
    const fallbackBody = caption || (opts.mediaType === 'image' ? '📷 Photo' : '🎤 Voice note');
    const isDisappearing = opts.mediaType === 'image' ? opts.disappearing !== false : false;

    const result = await query(
      `INSERT INTO messages (
         id, sender_id, receiver_id, message, created_at,
         media_type, media_url, media_storage_key, media_mime_type,
         audio_duration_ms, is_disappearing
       )
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10)
       RETURNING id, sender_id, receiver_id, message, created_at,
                 media_type, media_url, audio_duration_ms,
                 is_disappearing, expires_at, viewed_at`,
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
      ]
    );

    return attachSenderName(presentMessage(result.rows[0] as ConversationRow, senderId));
  },

  /**
   * Recipient marks a disappearing message as viewed. Starts the 10s burn
   * window. Idempotent — subsequent views won't extend the window.
   * Returns the updated message row (scrubbed if already expired).
   */
  async markMessageViewed(viewerId: string, messageId: string) {
    const message = await query(
      `SELECT sender_id FROM messages WHERE id = $1 AND receiver_id = $2`,
      [messageId, viewerId],
    );
    if (!message.rows[0]) throw new Error('message_not_found_or_not_recipient');
    await accessControl.assertInteraction(viewerId, message.rows[0].sender_id, { requireMatch: true });

    const result = await query(
      `UPDATE messages
          SET viewed_at = COALESCE(viewed_at, NOW()),
              expires_at = COALESCE(
                expires_at,
                CASE WHEN is_disappearing THEN NOW() + ($3 || ' milliseconds')::interval ELSE NULL END
              )
        WHERE id = $1
          AND receiver_id = $2
        RETURNING id, sender_id, receiver_id, message, created_at,
                  media_type, media_url, audio_duration_ms,
                  is_disappearing, expires_at, viewed_at`,
      [messageId, viewerId, DISAPPEAR_WINDOW_MS]
    );

    if (result.rows.length === 0) {
      throw new Error('message_not_found_or_not_recipient');
    }
    return presentMessage(result.rows[0] as ConversationRow, viewerId);
  },

  async getConversation(userId: string, otherId: string, limit: number = 50) {
    await accessControl.assertInteraction(userId, otherId, { requireMatch: true });
    const result = await query(
      `SELECT id, sender_id, receiver_id, message, created_at,
              media_type, media_url, audio_duration_ms,
              is_disappearing, expires_at, viewed_at
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, otherId, limit]
    );

    return result.rows.reverse().map((r) => presentMessage(r as ConversationRow, userId));
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
        online
       FROM (
         SELECT DISTINCT ON (
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
         )
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
           u.name AS other_user_name,
           m.created_at AS last_message_time,
           m.message AS last_message,
           u.photo_url,
           COALESCE(p.online, false) AS online
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
      [userId]
    );

    return result.rows;
  },

  async getMedia(viewerId: string, messageId: string) {
    const result = await query(
      `SELECT id, sender_id, receiver_id, media_storage_key, media_mime_type,
              is_disappearing, expires_at
       FROM messages
       WHERE id = $1 AND media_storage_key IS NOT NULL`,
      [messageId],
    );
    const row = result.rows[0];
    if (!row || (row.sender_id !== viewerId && row.receiver_id !== viewerId)) {
      throw new SecurityError('media_unavailable', 404, 'Media unavailable');
    }
    const otherId = row.sender_id === viewerId ? row.receiver_id : row.sender_id;
    await accessControl.assertInteraction(viewerId, otherId, { requireMatch: true });
    if (isExpiredMedia(row.is_disappearing, row.expires_at)) {
      throw new SecurityError('media_expired', 410, 'Media expired');
    }
    return {
      storageKey: row.media_storage_key as string,
      mimeType: row.media_mime_type as string,
    };
  },
};
