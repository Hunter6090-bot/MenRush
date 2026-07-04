import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSocket } from './useSocket';
import { useAuthStore, useNotificationStore, useUnreadStore } from './store';
import { mapSocketNotification } from '../lib/notifications';
import type { Notification } from './store';

/**
 * App-level socket listeners for incoming messages and social notifications.
 */
export function useGlobalMessageNotifications() {
  const socket = useSocket();
  const userId = useAuthStore((s) => s.user?.id);
  const location = useLocation();
  const addUnread = useUnreadStore((s) => s.addUnread);
  const upsertNotification = useNotificationStore((s) => s.upsertNotification);

  useEffect(() => {
    if (!socket || !userId) return;

    const onMessage = (data: {
      sender_id: string;
      receiver_id: string;
      sender_name?: string;
    }) => {
      if (data.sender_id === userId) return;
      if (data.receiver_id !== userId) return;

      const isViewingConversation = location.pathname === `/messages/${data.sender_id}`;
      if (!isViewingConversation) {
        addUnread(data.sender_id);
      }
    };

    const onNotification = (data: {
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
    }) => {
      upsertNotification(mapSocketNotification(data));
    };

    socket.on('message', onMessage);
    socket.on('notification', onNotification);

    return () => {
      socket.off('message', onMessage);
      socket.off('notification', onNotification);
    };
  }, [socket, userId, location.pathname, addUnread, upsertNotification]);
}
