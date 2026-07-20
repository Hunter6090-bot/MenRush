/**
 * Legacy ID verification hard gate.
 *
 * Government-ID checking is now an optional trust tier. Keep this compatibility
 * function while old middleware call sites are removed, but never use ID status
 * to deny ordinary app access. Mandatory adult assurance is a separate system.
 */
export function isIdVerificationRequired(): boolean {
  return false;
}
