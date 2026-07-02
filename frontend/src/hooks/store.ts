import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  age?: number;
  bio?: string;
  photo_url?: string;
  is_verified?: boolean;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));

interface LocationState {
  lat: number | null;
  lng: number | null;
  setLocation: (lat: number, lng: number) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  lat: null,
  lng: null,
  setLocation: (lat, lng) => set({ lat, lng }),
}));

interface UnreadState {
  count: number;
  senderIds: string[];
  addUnread: (senderId: string) => void;
  clearUnread: () => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  count: 0,
  senderIds: [],
  addUnread: (senderId) =>
    set((s) => ({
      count: s.count + 1,
      senderIds: s.senderIds.includes(senderId) ? s.senderIds : [...s.senderIds, senderId],
    })),
  clearUnread: () => set({ count: 0, senderIds: [] }),
}));

export interface Notification {
  id: string;
  type: 'like' | 'match' | 'message';
  message: string;
  userId?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        {
          ...n,
          id: Math.random().toString(36).substring(7),
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...s.notifications,
      ].slice(0, 50), // Keep last 50
    })),
  markAsRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  clearAll: () => set({ notifications: [] }),
}));
