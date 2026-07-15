import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const messageService = {
  async sendMessage(senderId: string, receiverId: string, message: string) {
    const id = uuidv4();
    // Simple sanitization: remove any potential script tags
    const sanitized = message.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();

    const result = await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, sender_id, receiver_id, message, created_at`,
      [id, senderId, receiverId, sanitized]
    );

    const savedMessage = result.rows[0] as {
      id: string;
      sender_id: string;
      receiver_id: string;
      message: string;
      created_at: string;
      sender_name?: string;
    };

    // Get sender name for notification
    const senderRes = await query(`SELECT name FROM users WHERE id = $1`, [senderId]);
    if (senderRes.rows[0]) {
      savedMessage.sender_name = senderRes.rows[0].name;
    }

    return savedMessage;
  },

  async getConversation(userId: string, otherId: string, limit: number = 50) {
    const result = await query(
      `SELECT id, sender_id, receiver_id, message, created_at
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, otherId, limit]
    );

    return result.rows.reverse();
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
