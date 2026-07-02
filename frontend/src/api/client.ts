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
    filters?: { minAge?: number; maxAge?: number; interests?: string[] }
  ) =>
    apiClient.get('/users/nearby', {
      params: {
        lat,
        lng,
        radius,
        minAge: filters?.minAge,
        maxAge: filters?.maxAge,
        interests: filters?.interests?.join(','),
      },
    }),
  getProfile: (id: string) => apiClient.get(`/users/profile/${id}`),
  updateLocation: (lat: number, lng: number) =>
    apiClient.post('/users/location', { lat, lng }),
  updateProfile: (data: { bio?: string; photo_url?: string; interests?: string[] }) =>
    apiClient.post('/users/profile', data),
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.post('/users/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  likeUser: (id: string) => apiClient.post(`/users/like/${id}`),
  getMatches: () => apiClient.get('/users/matches'),
};

export const messagesAPI = {
  sendMessage: (receiver_id: string, message: string) =>
    apiClient.post('/messages', { receiver_id, message }),
  getConversation: (otherId: string) =>
    apiClient.get(`/messages/conversation/${otherId}`),
  getConversations: () => apiClient.get('/messages/conversations'),
};

type ContactSubmitPayload = {
  name: string;
  email: string;
  enquiryType: 'general' | 'privacy' | 'support' | 'press';
  message: string;
};

export const contactAPI = {
  submit: (data: ContactSubmitPayload) =>
    apiClient.post<{ success: boolean; message: string }>('/contact', data),
};

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
