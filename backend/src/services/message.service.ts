import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
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

async function assertMatched(senderId: string, receiverId: string): Promise<void> {
  const matchCheck = await query(
    `SELECT 1 FROM likes l1
     JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
     WHERE l1.liker_id = $1 AND l1.liked_id = $2`,
    [senderId, receiverId]
  );
  if (matchCheck.rows.length === 0) {
    throw new Error('You can only message people you have matched with');
  }
}

async function attachSenderName<T extends { sender_id: string }>(
  row: T & Partial<{ sender_name: string }>
): Promise<T & { sender_name?: string }> {
  const r = await query(`SELECT name FROM users WHERE id = $1`, [row.sender_id]);
  if (r.rows[0]) row.sender_name = r.rows[0].name;
  return row;
}

export const messageService = {
  async sendMessage(senderId: string, receiverId: string, message: string) {
    await assertMatched(senderId, receiverId);

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

    return attachSenderName(scrubExpired(result.rows[0] as ConversationRow));
  },

  async sendMediaMessage(
    senderId: string,
    receiverId: string,
    opts: {
      mediaType: MediaKind;
      mediaUrl: string;
      caption?: string;
      disappearing?: boolean;
      audioDurationMs?: number;
    }
  ) {
    await assertMatched(senderId, receiverId);

    const id = uuidv4();
    const caption = (opts.caption ?? '').replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
    // Default body — UI uses this if media fails to load.
    const fallbackBody = caption || (opts.mediaType === 'image' ? '📷 Photo' : '🎤 Voice note');
    const isDisappearing = opts.mediaType === 'image' ? opts.disappearing !== false : false;

    const result = await query(
      `INSERT INTO messages (
         id, sender_id, receiver_id, message, created_at,
         media_type, media_url, audio_duration_ms, is_disappearing
       )
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
       RETURNING id, sender_id, receiver_id, message, created_at,
                 media_type, media_url, audio_duration_ms,
                 is_disappearing, expires_at, viewed_at`,
      [
        id,
        senderId,
        receiverId,
        fallbackBody,
        opts.mediaType,
        opts.mediaUrl,
        opts.mediaType === 'audio' ? opts.audioDurationMs ?? null : null,
        isDisappearing,
      ]
    );

    return attachSenderName(scrubExpired(result.rows[0] as ConversationRow));
  },

  /**
   * Recipient marks a disappearing message as viewed. Starts the 10s burn
   * window. Idempotent — subsequent views won't extend the window.
   * Returns the updated message row (scrubbed if already expired).
   */
  async markMessageViewed(viewerId: string, messageId: string) {
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
    return scrubExpired(result.rows[0] as ConversationRow);
  },

  async getConversation(userId: string, otherId: string, limit: number = 50) {
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

    return result.rows.reverse().map((r) => scrubExpired(r as ConversationRow));
  },

  async getConversations(userId: string) {
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
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END,
           m.created_at DESC
       ) sub
       ORDER BY last_message_time DESC`,
      [userId]
    );

    return result.rows;
  },
};
