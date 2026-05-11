import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

export const messagesAPI = {
  sendMessage: (receiver_id: string, message: string) =>
    apiClient.post('/messages', { receiver_id, message }),
  getConversation: (otherId: string) =>
    apiClient.get(`/messages/conversation/${otherId}`),
  getConversations: () => apiClient.get('/messages/conversations'),
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

export const aiAPI = {
  generateImage: (prompt: string, numberOfImages?: number) =>
    apiClient.post<{ images: Array<{ imageBase64: string; mimeType: string }> }>(
      '/ai/generate-image',
      { prompt, numberOfImages }
    ),
};

export { apiClient };
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
