/**
 * ID verification hard gate.
 *
 * Beta default: OFF. Users can register and use the app without verifying.
 * Verification code remains available for grand opening — only re-enable by
 * explicitly setting REQUIRE_ID_VERIFICATION=true (and matching frontend
 * VITE_REQUIRE_ID_VERIFICATION=true). Do not set this on Railway for beta.
 */
export function isIdVerificationRequired(): boolean {
  return process.env.REQUIRE_ID_VERIFICATION === 'true';
}
