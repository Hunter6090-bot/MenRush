import axios from 'axios';
import { useAuthStore } from '../hooks/store';

/** Strip whitespace and accidental literal "\\n" from Vercel env paste mistakes. */
function sanitizeEnvUrl(raw: unknown, fallback = ''): string {
  if (typeof raw !== 'string') return fallback;
  let s = raw.trim();
  // Env values sometimes contain the two-char sequence \n from bad CLI/dashboard paste.
  while (s.endsWith('\\n') || s.endsWith('\\r')) {
    s = s.slice(0, -2).trimEnd();
  }
  s = s.replace(/[\r\n]+/g, '').trim();
  return s || fallback;
}

const API_BASE_URL = sanitizeEnvUrl(import.meta.env.VITE_API_URL, '/api').replace(/\/$/, '') || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/** Custom JWT is payload.signature (2 segments). Reject junk that only 401s forever. */
function isPlausibleToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.length < 16) return false;
  if (t === 'null' || t === 'undefined') return false;
  return t.includes('.');
}

apiClient.interceptors.request.use((config) => {
  // Prefer live store token so logout immediately stops Authorization headers.
  const raw = useAuthStore.getState().token ?? localStorage.getItem('token');
  if (isPlausibleToken(raw)) {
    config.headers.Authorization = `Bearer ${raw}`;
  } else if (raw) {
    // Corrupt token — clear so polls stop.
    useAuthStore.getState().logout();
  }
  return config;
});

/** Paths that legitimately return 401 without meaning "session dead". */
const AUTH_CHALLENGE_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/2fa/verify',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/beta/validate-invite',
];

let sessionExpiredHandling = false;

/**
 * Stale JWT → endless 401 spam on unread/notifications polls.
 * Must clear Zustand synchronously — async logout left store.token set while
 * localStorage was empty, so intervals kept firing unauthorized requests.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const reqUrl = String(error?.config?.url ?? '');
    const isAuthChallenge = AUTH_CHALLENGE_PATHS.some((p) => reqUrl.includes(p));

    if (status === 401 && !isAuthChallenge && !sessionExpiredHandling) {
      const store = useAuthStore.getState();
      const hadSession = Boolean(store.token || localStorage.getItem('token'));
      if (hadSession) {
        sessionExpiredHandling = true;
        store.logout();
        sessionExpiredHandling = false;
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  register: (data: unknown) => apiClient.post('/auth/register', data),
  login: (data: { email: string; password: string }) => apiClient.post('/auth/login', data),
  verifyTwoFactorLogin: (data: { pendingToken: string; code: string }) =>
    apiClient.post('/auth/2fa/verify', data),
  getTwoFactorStatus: () => apiClient.get<{ enabled: boolean; enabledAt: string | null }>('/auth/2fa/status'),
  setupTwoFactor: () =>
    apiClient.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup'),
  enableTwoFactor: (code: string) => apiClient.post('/auth/2fa/enable', { code }),
  disableTwoFactor: (code: string) => apiClient.post('/auth/2fa/disable', { code }),
  forgotPassword: (data: { email: string }) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; password: string }) => apiClient.post('/auth/reset-password', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient.post('/auth/change-password', data),
  getAccount: () => apiClient.get<{ email: string }>('/auth/account'),
  changeEmail: (data: { current_password: string; new_email: string }) =>
    apiClient.post<{ ok: boolean; email: string; message: string }>('/auth/change-email', data),
};

export const betaAPI = {
  validateInvite: (data: { code: string }) => apiClient.post('/beta/validate-invite', data),
};

export const usersAPI = {
  getMe: () => apiClient.get('/users/me'),
  getNearby: (
    lat: number,
    lng: number,
    radius?: number,
    filters?: {
      minAge?: number;
      maxAge?: number;
      interests?: string[];
      onlyPulse?: boolean;
      lookingFor?: string;
      mood?: string;
    }
  ) =>
    apiClient.get('/users/nearby', {
      params: {
        lat,
        lng,
        radius,
        minAge: filters?.minAge,
        maxAge: filters?.maxAge,
        interests: filters?.interests?.join(','),
        onlyPulse: filters?.onlyPulse ? 'true' : undefined,
        lookingFor: filters?.lookingFor,
        mood: filters?.mood,
      },
    }),
  getProfile: (id: string) => apiClient.get(`/users/profile/${id}`),
  searchProfiles: (q: string) =>
    apiClient.get<Array<{ id: string; name: string; age?: number; photo_url?: string; bio?: string; headline?: string }>>(
      '/users/search',
      { params: { q } },
    ),
  updateLocation: (lat: number, lng: number) =>
    apiClient.post('/users/location', { lat, lng }),
  updateProfile: (data: {
    bio?: string;
    headline?: string;
    looking_for?: string;
    photo_url?: string;
    cover_url?: string;
    cover_position_x?: number;
    cover_position_y?: number;
    cover_zoom?: number;
    interests?: string[];
  }) =>
    apiClient.post('/users/profile', data),
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.post('/users/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadCover: (file: File) => {
    const formData = new FormData();
    formData.append('cover', file);
    return apiClient.post('/users/cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  likeUser: (id: string) => apiClient.post(`/users/like/${id}`),
  updateVisibility: (isVisible: boolean) =>
    apiClient.patch('/users/visibility', { is_visible: isVisible }),
  getMatches: () => apiClient.get('/users/matches'),
  /** Outbound like target ids — hydrate Match CTA after reload. */
  getSentLikes: () => apiClient.get<{ ids: string[] }>('/users/likes/sent'),
  getReceivedLikesSummary: () =>
    apiClient.get<{
      count: number;
      is_premium: boolean;
      preview?: Array<{ id: string; name: string; age: number; photo_url?: string | null }>;
    }>('/users/likes/received/summary'),
  getProfileViews: () =>
    apiClient.get<{
      viewers: Array<{
        id: string;
        name: string;
        age: number;
        photo_url?: string | null;
        online?: boolean;
        viewed_at: string;
      }>;
      total: number;
      limit: number;
      is_premium: boolean;
      has_more: boolean;
      hidden_count: number;
    }>('/users/profile-views'),
  startPulse: (minutes?: number) =>
    apiClient.post<{ available_until: string }>('/users/pulse/start', minutes ? { minutes } : {}),
  stopPulse: () => apiClient.post<{ available_until: null }>('/users/pulse/stop'),
  blockUser: (id: string) => apiClient.post(`/users/block/${id}`),
  unblockUser: (id: string) => apiClient.delete(`/users/block/${id}`),
  reportUser: (id: string, reason: string, details?: string) =>
    apiClient.post(`/users/report/${id}`, { reason, details }),
};

export const notificationsAPI = {
  list: () =>
    apiClient.get<{
      notifications: Array<{
        id: string;
        type: 'message' | 'photo' | 'voice' | 'like' | 'match' | 'profile_view' | 'system' | 'missed_call';
        title: string;
        body?: string | null;
        link_path?: string | null;
        read: boolean;
        created_at: string;
        actor_id?: string | null;
        actor_name?: string | null;
        actor_photo_url?: string | null;
      }>;
      unread_count: number;
    }>('/notifications'),
  markRead: (id: string) =>
    apiClient.patch<{ ok: boolean; unread_count: number }>(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post<{ ok: boolean; unread_count: number }>('/notifications/read-all'),
};

export interface PulseStateDTO {
  is_pulsing: boolean;
  pulse_expires_at: string | null;
  next_pulse_allowed_at: string | null;
  is_premium?: boolean;
}

export const pulseAPI = {
  getMe: () => apiClient.get<PulseStateDTO>('/pulse/me'),
  start: (durationMin: 60 | 90 | 120) =>
    apiClient.post<{ ok: true; expires_at: string }>('/pulse/start', { duration_min: durationMin }),
  stop: () => apiClient.post<{ ok: true }>('/pulse/stop'),
};

export type MediaKind = 'image' | 'audio' | 'video';
export type MessageMediaKind = MediaKind | 'location';

export interface MessageDTO {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
  media_type: MessageMediaKind | null;
  media_url: string | null;
  audio_duration_ms: number | null;
  is_disappearing: boolean;
  expires_at: string | null;
  viewed_at: string | null;
  /** Disappearing images: total views allowed (null = permanent). */
  max_views?: number | null;
  /** Disappearing images: views the recipient has consumed so far. */
  view_count?: number;
  /** Disappearing images: views still remaining (null = permanent). */
  remaining_views?: number | null;
  /** Server-side flag — true when a disappearing image's views are exhausted. */
  expired: boolean;
  /** Set when the sender withdraws media from the chat. */
  withdrawn_at?: string | null;
}

export interface SendMediaOptions {
  kind: MediaKind;
  caption?: string;
  /** Images only: true = view-limited (disappearing), false/undefined = permanent. */
  disappearing?: boolean;
  /** Disappearing images: how many times the recipient may view it (default 1). */
  maxViews?: number;
  /** Duration in ms — required for voice notes. */
  durationMs?: number;
}

export const messagesAPI = {
  sendMessage: (receiver_id: string, message: string) =>
    apiClient.post<MessageDTO>('/messages', { receiver_id, message }),
  sendLocation: (receiver_id: string, lat: number, lng: number) =>
    apiClient.post<MessageDTO>('/messages/location', { receiver_id, lat, lng }),
  getConversation: (otherId: string) =>
    apiClient.get<MessageDTO[]>(`/messages/conversation/${otherId}`),
  getConversations: () => apiClient.get('/messages/conversations'),
  getUnreadSummary: () =>
    apiClient.get<{ total: number; bySender: Record<string, number> }>('/messages/unread'),
  sendMedia: (receiver_id: string, file: File | Blob, opts: SendMediaOptions) => {
    const fd = new FormData();
    fd.append('receiver_id', receiver_id);
    fd.append('kind', opts.kind);
    if (opts.caption) fd.append('caption', opts.caption);
    if (opts.disappearing === true) fd.append('disappearing', 'true');
    if (opts.maxViews != null) fd.append('max_views', String(Math.round(opts.maxViews)));
    if (opts.durationMs != null) fd.append('duration_ms', String(Math.round(opts.durationMs)));
    // Blobs from MediaRecorder don't have a filename — give them one so multer is happy.
    const filename =
      file instanceof File
        ? file.name
        : `${opts.kind}-${Date.now()}.${
            opts.kind === 'audio' ? 'webm' : opts.kind === 'video' ? 'webm' : 'jpg'
          }`;
    fd.append('media', file, filename);
    return apiClient.post<MessageDTO>('/messages/media', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  markViewed: (messageId: string) =>
    apiClient.post<MessageDTO>(`/messages/${messageId}/view`),
  withdrawMedia: (messageId: string) =>
    apiClient.post<MessageDTO>(`/messages/${messageId}/withdraw`),
};

export interface MeetAgreementState {
  my_confirmed: boolean;
  peer_confirmed: boolean;
  mutual: boolean;
  my_confirmed_at: string | null;
  peer_confirmed_at: string | null;
}

export const meetAPI = {
  getState: (peerId: string) => apiClient.get<MeetAgreementState>(`/meet/${peerId}`),
  confirm: (peerId: string) => apiClient.post<MeetAgreementState>(`/meet/${peerId}/confirm`),
  revoke: (peerId: string) => apiClient.post<MeetAgreementState>(`/meet/${peerId}/revoke`),
};

export const roomsAPI = {
  createRoom: (data: any) => apiClient.post('/rooms', data),
  getRooms: () => apiClient.get('/rooms'),
  getRoom: (roomId: string) => apiClient.get(`/rooms/${roomId}`),
  getMembers: (roomId: string) =>
    apiClient.get<Array<{ id: string; name: string; photo_url?: string; role?: string }>>(
      `/rooms/${roomId}/members`,
    ),
  addMember: (roomId: string, userId: string) =>
    apiClient.post(`/rooms/${roomId}/members`, { user_id: userId }),
  joinRoom: (roomId: string) => apiClient.post(`/rooms/${roomId}/join`),
  leaveRoom: (roomId: string) => apiClient.post(`/rooms/${roomId}/leave`),
  getMessages: (roomId: string, before?: string) =>
    apiClient.get(`/rooms/${roomId}/messages`, { params: { before } }),
  sendMessage: (roomId: string, message: string, replyTo?: string) =>
    apiClient.post(`/rooms/${roomId}/messages`, { message, reply_to: replyTo }),
};

export type ContactSubmitPayload = {
  name: string;
  email: string;
  enquiryType: 'general' | 'privacy' | 'support' | 'press';
  message: string;
};

export const contactAPI = {
  submit: (data: ContactSubmitPayload) =>
    apiClient.post<{ success: boolean; message: string }>('/contact', data),
};

// ── Mood ──────────────────────────────────────────────────────────────────
// Mirrors backend MOOD_VALUES. Auto-expires server-side after 6h.
export type Mood =
  | 'roaming'
  | 'looking'
  | 'down_to_chat'
  | 'dont_talk_just_watch'
  | 'at_a_bar'
  | 'hosting'
  | 'travelling';

export const MOOD_LABELS: Record<Mood, string> = {
  roaming: 'Roaming',
  looking: 'Looking',
  down_to_chat: 'Down to Chat',
  dont_talk_just_watch: "Don't Talk, Just Watch",
  at_a_bar: 'At a Bar',
  hosting: 'Hosting',
  travelling: 'Travelling',
};

export const profileMetaAPI = {
  getMood: () =>
    apiClient.get<{ mood: Mood | null; mood_set_at: string | null }>('/profile-meta/mood'),
  setMood: (mood: Mood | null) =>
    apiClient.post<{ mood: Mood | null; mood_set_at: string | null }>('/profile-meta/mood', { mood }),
  getGhost: () => apiClient.get<{ is_ghost: boolean }>('/profile-meta/ghost'),
  setGhost: (is_ghost: boolean) =>
    apiClient.post<{ is_ghost: boolean }>('/profile-meta/ghost', { is_ghost }),
  getLiveLocationSharing: () =>
    apiClient.get<{ enabled: boolean }>('/profile-meta/live-location-sharing'),
  setLiveLocationSharing: (enabled: boolean) =>
    apiClient.post<{ enabled: boolean }>('/profile-meta/live-location-sharing', { enabled }),
};

// ── Albums ────────────────────────────────────────────────────────────────
export interface AlbumDTO {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_locked: boolean;
  cover_url: string | null;
  photo_count: number;
  created_at: string;
  updated_at: string;
  /** Present only when listing someone else's albums via /albums/user/:id. */
  unlocked?: boolean;
}

export interface AlbumPhotoDTO {
  id: string;
  photo_url: string;
  position: number;
  created_at: string;
}

export const albumsAPI = {
  listMine: () =>
    apiClient.get<{ albums: AlbumDTO[]; photo_total: number; free_cap: number }>('/albums/mine'),
  create: (data: { name: string; description?: string; is_locked?: boolean }) =>
    apiClient.post<AlbumDTO>('/albums', data),
  remove: (albumId: string) => apiClient.delete<{ deleted: true }>(`/albums/${albumId}`),
  removePhoto: (albumId: string, photoId: string) =>
    apiClient.delete<{ deleted: true }>(`/albums/${albumId}/photos/${photoId}`),
  listPhotos: (albumId: string) =>
    apiClient.get<{ photos: AlbumPhotoDTO[]; unlocked: boolean; locked: boolean }>(
      `/albums/${albumId}/photos`,
    ),
  upload: (albumId: string, file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return apiClient.post<{ photo_url: string }>(`/albums/${albumId}/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  listForUser: (userId: string) =>
    apiClient.get<{ albums: AlbumDTO[] }>(`/albums/user/${userId}`),
  grant: (albumId: string, viewerId: string) =>
    apiClient.post<{ granted: true }>(`/albums/${albumId}/grant`, { viewer_id: viewerId }),
  revoke: (albumId: string, viewerId: string) =>
    apiClient.delete<{ granted: false }>(`/albums/${albumId}/grant/${viewerId}`),
};

// ── Events (After Hours) ──────────────────────────────────────────────────
export interface EventDTO {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
  member_count: number;
  distance_m: number | null;
  is_live: boolean;
}

export const eventsAPI = {
  getNearby: (lat: number, lng: number, radiusKm?: number, limit?: number) =>
    apiClient.get<EventDTO[]>('/events/nearby', {
      params: { lat, lng, radius: radiusKm, limit },
    }),
};

// ── Hot Spots (venue check-ins — not user Pulse boost) ───────────────────
export interface HotSpotCategoryDTO {
  id: number;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
}

export interface HotSpotDTO {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  category_id: number;
  category_slug: string;
  category_name: string;
  category_icon: string;
  distance_km: number | null;
  live_count: number | string;
  live_count_exact: number;
  is_checked_in: boolean;
  my_checkin_anonymous: boolean | null;
}

export const hotSpotsAPI = {
  listCategories: () =>
    apiClient.get<{ categories: HotSpotCategoryDTO[] }>('/hot-spots/categories'),
  listNearby: (lat: number, lng: number, radiusKm?: number, category?: string) =>
    apiClient.get<{ spots: HotSpotDTO[] }>('/hot-spots', {
      params: { lat, lng, radiusKm, category },
    }),
  getSpot: (id: string) => apiClient.get<{ spot: HotSpotDTO }>(`/hot-spots/${id}`),
  checkIn: (id: string, anonymous = false) =>
    apiClient.post<{ ok: boolean; spot: HotSpotDTO }>(`/hot-spots/${id}/check-in`, { anonymous }),
  checkOut: (id?: string) =>
    id
      ? apiClient.post<{ ok: boolean }>(`/hot-spots/${id}/check-out`)
      : apiClient.post<{ ok: boolean }>('/hot-spots/check-out'),
  getMyCheckIn: () =>
    apiClient.get<{ check_in: unknown | null }>('/hot-spots/me/check-in'),
};

export const aiAPI = {
  generateImage: (prompt: string, numberOfImages?: number) =>
    apiClient.post<{ images: Array<{ imageBase64: string; mimeType: string }> }>(
      '/ai/generate-image',
      { prompt, numberOfImages }
    ),
};

export { apiClient };

function resolveSocketUrl(): string {
  const socket = sanitizeEnvUrl(import.meta.env.VITE_SOCKET_URL);
  if (socket) return socket.replace(/\/$/, '');
  const apiUrl = sanitizeEnvUrl(import.meta.env.VITE_API_URL);
  if (apiUrl && /^https?:\/\//.test(apiUrl)) {
    return apiUrl.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

// Keep signalling on the same host as the API when deployed separately from
// the static frontend (e.g. Railway backend + Vercel frontend).
export const SOCKET_URL = resolveSocketUrl();
