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

    return result.rows[0];
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
      `SELECT DISTINCT 
        CASE 
          WHEN sender_id = $1 THEN receiver_id 
          ELSE sender_id 
        END as other_user_id,
        (SELECT name FROM users u WHERE u.id = CASE 
          WHEN sender_id = $1 THEN receiver_id 
          ELSE sender_id 
        END) as other_user_name,
        MAX(created_at) as last_message_time
       FROM messages
       WHERE sender_id = $1 OR receiver_id = $1
       GROUP BY other_user_id
       ORDER BY last_message_time DESC`,
      [userId]
    );

    return result.rows;
  },
};
