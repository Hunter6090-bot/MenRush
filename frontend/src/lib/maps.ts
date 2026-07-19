function isAppleDevice(): boolean {
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
}

/** Open native maps for turn-by-turn directions to a coordinate. */
export function openMapsDirections(lat: number, lng: number, label = 'Meet here'): void {
  const coords = `${lat},${lng}`;
  const encodedLabel = encodeURIComponent(label);
  const url = isAppleDevice()
    ? `maps://?daddr=${coords}&q=${encodedLabel}`
    : `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=walking`;

  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Open native maps centered on a coordinate (view, not directions). */
export function openMapsAt(lat: number, lng: number, label = 'Location'): void {
  const coords = `${lat},${lng}`;
  const encodedLabel = encodeURIComponent(label);
  const url = isAppleDevice()
    ? `maps://?ll=${coords}&q=${encodedLabel}`
    : `https://www.google.com/maps/search/?api=1&query=${coords}`;

  window.open(url, '_blank', 'noopener,noreferrer');
}
