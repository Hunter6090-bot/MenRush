/** True when the browser is on a phone-sized mobile device (not desktop/tablet). */
export function isPhoneDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}