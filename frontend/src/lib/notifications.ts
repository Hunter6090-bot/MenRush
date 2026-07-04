import type { Notification } from '../hooks/store';

export interface NotificationDTO {
  id: string;
  type: Notification['type'];
  title: string;
  body?: string | null;
  link_path?: string | null;
  read: boolean;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_photo_url?: string | null;
}

export function mapNotification(row: NotificationDTO): Notification {
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
}

export function mapSocketNotification(data: {
  id?: string;
  type: Notification['type'];
  message: string;
  body?: string;
  userId?: string;
  actorName?: string;
  actorPhotoUrl?: string;
  linkPath?: string;
  createdAt?: string;
  read?: boolean;
}): Notification {
  return {
    id: data.id ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: data.type,
    message: data.message,
    body: data.body,
    userId: data.userId,
    actorName: data.actorName,
    actorPhotoUrl: data.actorPhotoUrl,
    linkPath: data.linkPath,
    createdAt: data.createdAt ?? new Date().toISOString(),
    read: data.read ?? false,
  };
}

export function notificationDestination(notification: Notification): string {
  if (notification.linkPath) return notification.linkPath;
  switch (notification.type) {
    case 'message':
    case 'photo':
    case 'voice':
    case 'missed_call':
      return notification.userId ? `/messages/${notification.userId}` : '/conversations';
    case 'match':
      return notification.userId ? `/messages/${notification.userId}` : '/matches';
    case 'like':
      return notification.userId ? `/profile/${notification.userId}` : '/matches';
    case 'profile_view':
      return '/profile';
    default:
      return '/notifications';
  }
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function notificationTypeLabel(type: Notification['type']): string {
  switch (type) {
    case 'message':
      return 'Message';
    case 'photo':
      return 'Photo';
    case 'voice':
      return 'Voice note';
    case 'like':
      return 'Match';
    case 'match':
      return 'Match';
    case 'profile_view':
      return 'Profile view';
    case 'missed_call':
      return 'Missed call';
    default:
      return 'Update';
  }
}
