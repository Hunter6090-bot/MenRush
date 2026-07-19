import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';

export type NotificationType =
  | 'message'
  | 'photo'
  | 'voice'
  | 'like'
  | 'match'
  | 'profile_view'
  | 'system'
  | 'missed_call';

export interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link_path: string | null;
  read: boolean;
  created_at: string;
  actor_name?: string | null;
  actor_photo_url?: string | null;
}

interface CreateParams {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  linkPath?: string | null;
}

function mapRow(row: Record<string, unknown>): NotificationRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    actor_id: (row.actor_id as string | null) ?? null,
    type: row.type as NotificationType,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    link_path: (row.link_path as string | null) ?? null,
    read: Boolean(row.read),
    created_at: new Date(row.created_at as string).toISOString(),
    actor_name: (row.actor_name as string | null) ?? null,
    actor_photo_url: (row.actor_photo_url as string | null) ?? null,
  };
}

const LIST_SELECT = `
  SELECT
    n.id,
    n.user_id,
    n.actor_id,
    n.type,
    n.title,
    n.body,
    n.link_path,
    n.read,
    n.created_at,
    u.name AS actor_name,
    u.photo_url AS actor_photo_url
  FROM notifications n
  LEFT JOIN users u ON u.id = n.actor_id
`;

export const notificationService = {
  async create(params: CreateParams): Promise<NotificationRow> {
    const id = uuidv4();
    await query(
      `INSERT INTO notifications (id, user_id, actor_id, type, title, body, link_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        params.userId,
        params.actorId ?? null,
        params.type,
        params.title,
        params.body ?? null,
        params.linkPath ?? null,
      ],
    );

    const result = await query(`${LIST_SELECT} WHERE n.id = $1`, [id]);
    return mapRow(result.rows[0]);
  },

  async listForUser(userId: string, limit = 50): Promise<NotificationRow[]> {
    const result = await query(
      `${LIST_SELECT}
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(mapRow);
  },

  async unreadCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    return (result.rows[0]?.total as number) ?? 0;
  },

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND user_id = $2 AND read = FALSE
       RETURNING id`,
      [notificationId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async markAllRead(userId: string): Promise<number> {
    const result = await query(
      `UPDATE notifications SET read = TRUE
       WHERE user_id = $1 AND read = FALSE
       RETURNING id`,
      [userId],
    );
    return result.rowCount ?? 0;
  },

  /** Emit payload shape consumed by the frontend socket + store. */
  toSocketPayload(row: NotificationRow) {
    return {
      id: row.id,
      type: row.type,
      message: row.title,
      body: row.body ?? undefined,
      userId: row.actor_id ?? undefined,
      actorName: row.actor_name ?? undefined,
      actorPhotoUrl: row.actor_photo_url ?? undefined,
      linkPath: row.link_path ?? undefined,
      createdAt: row.created_at,
      read: row.read,
    };
  },

  async notify(io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null, params: CreateParams) {
    const row = await this.create(params);
    io?.to(`user:${params.userId}`).emit('notification', this.toSocketPayload(row));
    return row;
  },
};
