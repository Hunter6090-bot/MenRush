export const FEATURES = {
  videoCalls: import.meta.env.VITE_FEATURE_VIDEO === 'true',
  chatRooms: import.meta.env.VITE_FEATURE_ROOMS === 'true',
} as const;
