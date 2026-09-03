// Feature flags. Video calls default ON because the signaling stack is
// complete; the optional TURN config (VITE_TURN_URL) only affects reliability
// for users on strict NATs. Set VITE_FEATURE_VIDEO=false to hide the launcher.
//
// Government-ID checking is an optional trust mark and must never gate ordinary
// access. Trust Centre = one optional Veriff path + one badge. No Authentic-person
// ladder; Adult 18+ stays on signup DOB. Parked #97 stays parked.
//
// Veriff (ID + selfie) is opt-in only. Product lock: do not turn on
// requireIdVerification for open signup — self-attested 18+ DOB only.
// Set VITE_FEATURE_VERIFF=true to enable the post-signup Veriff entry path.
export const FEATURES = {
  videoCalls: import.meta.env.VITE_FEATURE_VIDEO !== 'false',
  chatRooms: import.meta.env.VITE_FEATURE_ROOMS === 'true',
  requireIdVerification: false,
  veriffAfterSignup: import.meta.env.VITE_FEATURE_VERIFF === 'true',
} as const;
