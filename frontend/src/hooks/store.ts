import { create } from 'zustand';
import { syncLocaleCoords } from '../lib/localeUnits';

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
  patchUser: (updates: Partial<User>) => void;
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
  patchUser: (updates) =>
    set((s) => {
      if (!s.user) return s;
      const next = { ...s.user, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
      return { user: next };
    }),
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));

const LOCATION_STORAGE_KEY = 'menrush_last_location';

function readStoredLocation(): { lat: number | null; lng: number | null } {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return { lat: null, lng: null };
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { lat: null, lng: null };
    return { lat, lng };
  } catch {
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return { lat: null, lng: null };
  }
}

interface LocationState {
  lat: number | null;
  lng: number | null;
  setLocation: (lat: number, lng: number) => void;
  clearLocation: () => void;
}

const initialLocation = readStoredLocation();
if (initialLocation.lat != null && initialLocation.lng != null) {
  syncLocaleCoords(initialLocation.lat, initialLocation.lng);
}

export const useLocationStore = create<LocationState>((set) => ({
  lat: initialLocation.lat,
  lng: initialLocation.lng,
  setLocation: (lat, lng) => {
    syncLocaleCoords(lat, lng);
    try {
      localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify({ lat, lng, at: Date.now() }),
      );
    } catch {
      /* private mode / quota */
    }
    set({ lat, lng });
  },
  clearLocation: () => {
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ lat: null, lng: null });
  },
}));

interface UnreadState {
  count: number;
  senderIds: string[];
  /** Per-sender unread tally so opening one thread clears only that sender. */
  unreadBySender: Record<string, number>;
  addUnread: (senderId: string) => void;
  clearUnread: () => void;
  clearUnreadFrom: (senderId: string) => void;
  setUnreadFromServer: (bySender: Record<string, number>) => void;
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
  setUnreadFromServer: (bySender) =>
    set(() => {
      const unreadBySender: Record<string, number> = {};
      let count = 0;
      const senderIds: string[] = [];
      for (const [senderId, n] of Object.entries(bySender)) {
        if (n <= 0) continue;
        unreadBySender[senderId] = n;
        senderIds.push(senderId);
        count += n;
      }
      return { count, senderIds, unreadBySender };
    }),
}));

export interface Notification {
  id: string;
  type: 'message' | 'photo' | 'voice' | 'like' | 'match' | 'profile_view' | 'system' | 'missed_call';
  message: string;
  body?: string;
  userId?: string;
  actorName?: string;
  actorPhotoUrl?: string;
  linkPath?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loadError: string | null;
  setFromServer: (notifications: Notification[], unreadCount: number) => void;
  upsertNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setUnreadCount: (count: number) => void;
  setLoadError: (message: string | null) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loadError: null,
  setFromServer: (notifications, unreadCount) =>
    set({ notifications, unreadCount, loadError: null }),
  upsertNotification: (notification) =>
    set((s) => {
      const exists = s.notifications.some((n) => n.id === notification.id);
      const notifications = [
        notification,
        ...s.notifications.filter((n) => n.id !== notification.id),
      ].slice(0, 100);
      let unreadCount = s.unreadCount;
      if (!exists && !notification.read) unreadCount += 1;
      if (exists) {
        unreadCount = notifications.filter((n) => !n.read).length;
      }
      return { notifications, unreadCount };
    }),
  markAsRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      if (!target || target.read) return s;
      return {
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      };
    }),
  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setLoadError: (loadError) => set({ loadError }),
}));

// ── Call store ────────────────────────────────────────────────────────────────

type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallState {
  callStatus: CallStatus;
  peerId: string | null;
  peerName: string | null;
  incomingOffer: RTCSessionDescriptionInit | null;
  callSetupError: string | null;
  setIncoming: (peerId: string, peerName: string, offer: RTCSessionDescriptionInit) => void;
  setCalling: (peerId: string, peerName: string) => void;
  setConnected: () => void;
  setCallSetupError: (message: string | null) => void;
  resetCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  callStatus: 'idle',
  peerId: null,
  peerName: null,
  incomingOffer: null,
  callSetupError: null,
  setIncoming: (peerId, peerName, offer) =>
    set({ callStatus: 'ringing', peerId, peerName, incomingOffer: offer, callSetupError: null }),
  setCalling: (peerId, peerName) =>
    set({ callStatus: 'calling', peerId, peerName, incomingOffer: null, callSetupError: null }),
  setConnected: () => set({ callStatus: 'connected', callSetupError: null }),
  setCallSetupError: (message) => set({ callSetupError: message }),
  resetCall: () =>
    set({
      callStatus: 'idle',
      peerId: null,
      peerName: null,
      incomingOffer: null,
      callSetupError: null,
    }),
}));
