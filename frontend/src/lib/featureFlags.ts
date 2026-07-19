// Feature flags. Video calls default ON because the signaling stack is
// complete; the optional TURN config (VITE_TURN_URL) only affects reliability
// for users on strict NATs. Set VITE_FEATURE_VIDEO=false to hide the launcher.
//
// ID verification hard gate is OFF for beta. Do not set
// VITE_REQUIRE_ID_VERIFICATION=true until grand opening (must match backend
// REQUIRE_ID_VERIFICATION=true). Verification UI stays available but does not
// block entry.
export const FEATURES = {
  videoCalls: import.meta.env.VITE_FEATURE_VIDEO !== 'false',
  chatRooms: import.meta.env.VITE_FEATURE_ROOMS === 'true',
  requireIdVerification: import.meta.env.VITE_REQUIRE_ID_VERIFICATION === 'true',
} as const;
