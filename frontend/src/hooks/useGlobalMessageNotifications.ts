import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSocket } from './useSocket';
import { useAuthStore, useNotificationStore, useUnreadStore } from './store';

/**
 * App-level socket listeners for incoming messages. Mounted once inside the
 * router so unread badges and toasts update on every route — including
 * full-screen /messages/:id which does not use Layout.
 */
export function useGlobalMessageNotifications() {
  const socket = useSocket();
  const userId = useAuthStore((s) => s.user?.id);
  const location = useLocation();
  const addUnread = useUnreadStore((s) => s.addUnread);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!socket || !userId) return;

    const onMessage = (data: {
      sender_id: string;
      receiver_id: string;
      sender_name?: string;
      message?: string;
    }) => {
      // Never notify the sender on their own device.
      if (data.sender_id === userId) return;
      if (data.receiver_id !== userId) return;

      const isViewingConversation = location.pathname === `/messages/${data.sender_id}`;
      if (!isViewingConversation) {
        addUnread(data.sender_id);
        addNotification({
          type: 'message',
          message: `New message from ${data.sender_name || 'someone'}`,
          userId: data.sender_id,
        });
      }
    };

    const onNotification = (data: {
      type: 'like' | 'match' | 'message';
      message: string;
      userId?: string;
    }) => {
      addNotification({
        type: data.type,
        message: data.message,
        userId: data.userId,
      });
    };

    socket.on('message', onMessage);
    socket.on('notification', onNotification);

    return () => {
      socket.off('message', onMessage);
      socket.off('notification', onNotification);
    };
  }, [socket, userId, location.pathname, addUnread, addNotification]);
}
