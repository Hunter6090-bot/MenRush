/** Open native maps for turn-by-turn directions to a coordinate. */
export function openMapsDirections(lat: number, lng: number, label = 'Meet here'): void {
  const coords = `${lat},${lng}`;
  const encodedLabel = encodeURIComponent(label);
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

  const url = isApple
    ? `maps://?daddr=${coords}&q=${encodedLabel}`
    : `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=walking`;

  window.open(url, '_blank', 'noopener,noreferrer');
}
