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
  is_premium?: boolean;
  premium_tier?: 'free' | 'premium' | 'premium_plus';
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  setVerified: (status: NonNullable<User['verification_status']>, isVerified: boolean) => void;
  setPremium: (tier: NonNullable<User['premium_tier']>, isPremium: boolean) => void;
  logout: () => void;
}

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },
  setVerified: (status, isVerified) =>
    set((s) => {
      if (!s.user) return s;
      const next = { ...s.user, verification_status: status, is_verified: isVerified };
      localStorage.setItem('user', JSON.stringify(next));
      return { user: next };
    }),
  setPremium: (tier, isPremium) =>
    set((s) => {
      if (!s.user) return s;
      const next = { ...s.user, premium_tier: tier, is_premium: isPremium };
      localStorage.setItem('user', JSON.stringify(next));
      return { user: next };
    }),
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
  /** Per-sender unread tally so opening one thread clears only that sender. */
  unreadBySender: Record<string, number>;
  addUnread: (senderId: string) => void;
  clearUnread: () => void;
  clearUnreadFrom: (senderId: string) => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  count: 0,
  senderIds: [],
  unreadBySender: {},
  addUnread: (senderId) =>
    set((s) => ({
      count: s.count + 1,
      senderIds: s.senderIds.includes(senderId) ? s.senderIds : [...s.senderIds, senderId],
      unreadBySender: {
        ...s.unreadBySender,
        [senderId]: (s.unreadBySender[senderId] ?? 0) + 1,
      },
    })),
  clearUnread: () => set({ count: 0, senderIds: [], unreadBySender: {} }),
  clearUnreadFrom: (senderId) =>
    set((s) => {
      const n = s.unreadBySender[senderId] ?? 0;
      if (n === 0) return s;
      const unreadBySender = { ...s.unreadBySender };
      delete unreadBySender[senderId];
      return {
        count: Math.max(0, s.count - n),
        senderIds: s.senderIds.filter((id) => id !== senderId),
        unreadBySender,
      };
    }),
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

// ── Call store ────────────────────────────────────────────────────────────────

type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallState {
  callStatus: CallStatus;
  peerId: string | null;
  peerName: string | null;
  incomingOffer: RTCSessionDescriptionInit | null;
  setIncoming: (peerId: string, peerName: string, offer: RTCSessionDescriptionInit) => void;
  setCalling: (peerId: string, peerName: string) => void;
  setConnected: () => void;
  resetCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  callStatus: 'idle',
  peerId: null,
  peerName: null,
  incomingOffer: null,
  setIncoming: (peerId, peerName, offer) =>
    set({ callStatus: 'ringing', peerId, peerName, incomingOffer: offer }),
  setCalling: (peerId, peerName) =>
    set({ callStatus: 'calling', peerId, peerName, incomingOffer: null }),
  setConnected: () => set({ callStatus: 'connected' }),
  resetCall: () =>
    set({ callStatus: 'idle', peerId: null, peerName: null, incomingOffer: null }),
}));
