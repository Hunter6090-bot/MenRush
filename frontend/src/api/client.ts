import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data: unknown) => apiClient.post('/auth/register', data),
  login: (data: unknown) => apiClient.post('/auth/login', data),
  forgotPassword: (data: { email: string }) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; password: string }) => apiClient.post('/auth/reset-password', data),
};

export const usersAPI = {
  getMe: () => apiClient.get('/users/me'),
  getNearby: (
    lat: number,
    lng: number,
    radius?: number,
    filters?: { minAge?: number; maxAge?: number; interests?: string[]; onlyPulse?: boolean }
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
      },
    }),
  getProfile: (id: string) => apiClient.get(`/users/profile/${id}`),
  updateLocation: (lat: number, lng: number) =>
    apiClient.post('/users/location', { lat, lng }),
  updateProfile: (data: { bio?: string; headline?: string; looking_for?: string; photo_url?: string; interests?: string[] }) =>
    apiClient.post('/users/profile', data),
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.post('/users/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  likeUser: (id: string) => apiClient.post(`/users/like/${id}`),
  updateVisibility: (isVisible: boolean) =>
    apiClient.patch('/users/visibility', { is_visible: isVisible }),
  getMatches: () => apiClient.get('/users/matches'),
  startPulse: (minutes?: number) =>
    apiClient.post<{ available_until: string }>('/users/pulse/start', minutes ? { minutes } : {}),
  stopPulse: () => apiClient.post<{ available_until: null }>('/users/pulse/stop'),
  blockUser: (id: string) => apiClient.post(`/users/block/${id}`),
  unblockUser: (id: string) => apiClient.delete(`/users/block/${id}`),
  reportUser: (id: string, reason: string, details?: string) =>
    apiClient.post(`/users/report/${id}`, { reason, details }),
};

export interface PulseStateDTO {
  is_pulsing: boolean;
  pulse_expires_at: string | null;
  next_pulse_allowed_at: string | null;
}

export const pulseAPI = {
  getMe: () => apiClient.get<PulseStateDTO>('/pulse/me'),
  start: (durationMin: 60 | 90 | 120) =>
    apiClient.post<{ ok: true; expires_at: string }>('/pulse/start', { duration_min: durationMin }),
  stop: () => apiClient.post<{ ok: true }>('/pulse/stop'),
};

export type MediaKind = 'image' | 'audio';

export interface MessageDTO {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
  media_type: MediaKind | null;
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
  getConversation: (otherId: string) =>
    apiClient.get<MessageDTO[]>(`/messages/conversation/${otherId}`),
  getConversations: () => apiClient.get('/messages/conversations'),
  sendMedia: (receiver_id: string, file: File | Blob, opts: SendMediaOptions) => {
    const fd = new FormData();
    fd.append('receiver_id', receiver_id);
    fd.append('kind', opts.kind);
    if (opts.caption) fd.append('caption', opts.caption);
    if (opts.disappearing != null) fd.append('disappearing', String(opts.disappearing));
    if (opts.maxViews != null) fd.append('max_views', String(Math.round(opts.maxViews)));
    if (opts.durationMs != null) fd.append('duration_ms', String(Math.round(opts.durationMs)));
    // Blobs from MediaRecorder don't have a filename — give them one so multer is happy.
    const filename =
      file instanceof File
        ? file.name
        : `${opts.kind}-${Date.now()}.${opts.kind === 'audio' ? 'webm' : 'jpg'}`;
    fd.append('media', file, filename);
    return apiClient.post<MessageDTO>('/messages/media', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  markViewed: (messageId: string) =>
    apiClient.post<MessageDTO>(`/messages/${messageId}/view`),
};

export const roomsAPI = {
  createRoom: (data: any) => apiClient.post('/rooms', data),
  getRooms: () => apiClient.get('/rooms'),
  getRoom: (roomId: string) => apiClient.get(`/rooms/${roomId}`),
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

export const aiAPI = {
  generateImage: (prompt: string, numberOfImages?: number) =>
    apiClient.post<{ images: Array<{ imageBase64: string; mimeType: string }> }>(
      '/ai/generate-image',
      { prompt, numberOfImages }
    ),
};

export { apiClient };
// Keep signalling on the same origin as the app. This works for localhost,
// LAN development proxies, preview tunnels, and production without mixed
// content or accidentally resolving `localhost` on a user's phone.
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
