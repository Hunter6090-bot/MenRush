// Feature flags. Video calls default ON because the signaling stack is
// complete; the optional TURN config (VITE_TURN_URL) only affects reliability
// for users on strict NATs. Set VITE_FEATURE_VIDEO=false to hide the launcher.
//
// Government-ID checking is an optional trust tier and must never gate ordinary
// access. This compatibility flag remains until legacy wrappers are removed.
//
// Veriff (ID + selfie) is the post-signup identity path when enabled. The
// Identity checked badge still only appears after the Veriff decision webhook
// sets is_verified — never from client completion alone.
export const FEATURES = {
  videoCalls: import.meta.env.VITE_FEATURE_VIDEO !== 'false',
  chatRooms: import.meta.env.VITE_FEATURE_ROOMS === 'true',
  requireIdVerification: false,
  veriffAfterSignup: import.meta.env.VITE_FEATURE_VERIFF !== 'false',
} as const;
