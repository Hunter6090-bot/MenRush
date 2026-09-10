/** First letter of a display name for room tiles / temp-identity preview. */
export function roomLetterAvatar(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const ch = trimmed[0];
  return /[A-Za-z0-9]/.test(ch) ? ch.toUpperCase() : '?';
}
