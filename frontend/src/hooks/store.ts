import { create } from 'zustand';
import {
  clearAuthSession,
  persistAuthSession,
  persistAuthUser,
  readAuthSnapshot,
  type StoredAuthUser,
} from '../lib/authSession';
import { syncLocaleCoords } from '../lib/localeUnits';
import { applyLiveUpsert } from '../lib/notificationToasts';

type User = StoredAuthUser;

const REFRESH_TOKEN_KEY = 'refresh_token';

function readStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  /** Re-read localStorage/cookie into the store (PWA cold start / pageshow). */
  rehydrateAuth: () => boolean;
  setVerified: (status: NonNullable<User['verification_status']>, isVerified: boolean) => void;
  setPremium: (tier: NonNullable<User['premium_tier']>, isPremium: boolean) => void;
  patchUser: (updates: Partial<User>) => void;
  logout: () => void;
}

const boot = readAuthSnapshot();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: boot.user,
  token: boot.token,
  refreshToken: readStoredRefreshToken(),
  setAuth: (user, token, refreshToken) => {
    persistAuthSession(user, token);
    if (refreshToken) {
      try {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      } catch {
        /* private mode / quota */
      }
    }
    set((state) => ({
      user,
      token,
      refreshToken: refreshToken ?? state.refreshToken,
    }));
  },
  setTokens: (token, refreshToken) => {
    const user = get().user;
    if (user) {
      persistAuthSession(user, token);
    } else {
      try {
        localStorage.setItem('token', token);
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      /* ignore */
    }
    set({ token, refreshToken });
  },
  rehydrateAuth: () => {
    const snap = readAuthSnapshot();
    if (!snap.token) return false;
    const refreshToken = readStoredRefreshToken();
    const current = get();
    if (
      current.token === snap.token
      && current.user?.id === snap.user?.id
      && current.refreshToken === refreshToken
    ) {
      return true;
    }
    set({ user: snap.user, token: snap.token, refreshToken });
    return true;
  },
  setVerified: (status, isVerified) =>
    set((s) => {
      if (!s.user) return s;
      const next = { ...s.user, verification_status: status, is_verified: isVerified };
      persistAuthUser(next);
      return { user: next };
    }),
  setPremium: (tier, isPremium) =>
    set((s) => {
      if (!s.user) return s;
      const next = { ...s.user, premium_tier: tier, is_premium: isPremium };
      persistAuthUser(next);
      return { user: next };
    }),
  patchUser: (updates) =>
    set((s) => {
      if (!s.user) return s;
      const next = { ...s.user, ...updates };
      persistAuthUser(next);
      return { user: next };
    }),
  logout: () => {
    clearAuthSession();
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    set({ user: null, token: null, refreshToken: null });
    // Private notification content (message previews, etc.) must not linger
    // in memory once logged out — ToastNotifications is unmounted by the
    // token gate in App.tsx, but the store itself can still be read elsewhere.
    useNotificationStore.getState().resetNotifications();
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
  /** True after the first successful (or intentional empty) server pull this session. */
  serverSynced: boolean;
  /** Live socket events queued for toast UI — never filled by setFromServer backfill. */
  pendingToasts: Notification[];
  setFromServer: (notifications: Notification[], unreadCount: number) => void;
  resetNotifications: () => void;
  upsertNotification: (notification: Notification) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  deleteAllRead: () => void;
  setUnreadCount: (count: number) => void;
  setLoadError: (message: string | null) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loadError: null,
  serverSynced: false,
  pendingToasts: [],
  // Backfill / poll: badge + list only. Never enqueue toasts.
  setFromServer: (notifications, unreadCount) =>
    set({ notifications, unreadCount, loadError: null, serverSynced: true }),
  resetNotifications: () =>
    set({
      notifications: [],
      unreadCount: 0,
      loadError: null,
      serverSynced: false,
      pendingToasts: [],
    }),
  upsertNotification: (notification) =>
    set((s) => {
      const next = applyLiveUpsert(
        {
          notifications: s.notifications,
          unreadCount: s.unreadCount,
          serverSynced: s.serverSynced,
          pendingToasts: s.pendingToasts,
        },
        notification,
      );
      return next;
    }),
  dismissToast: (id) =>
    set((s) => ({
      pendingToasts: s.pendingToasts.filter((t) => t.id !== id),
    })),
  markAsRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      if (!target || target.read) return s;
      return {
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
        pendingToasts: s.pendingToasts.filter((t) => t.id !== id),
      };
    }),
  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
      pendingToasts: [],
    })),
  deleteNotification: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      if (!target) return s;
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: target.read ? s.unreadCount : Math.max(0, s.unreadCount - 1),
        pendingToasts: s.pendingToasts.filter((t) => t.id !== id),
      };
    }),
  deleteAllRead: () =>
    set((s) => ({ notifications: s.notifications.filter((n) => !n.read) })),
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
