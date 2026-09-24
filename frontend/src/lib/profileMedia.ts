/** Reserved preset assets are placeholders, never uploaded user media. */
export function profileMediaPath(url?: string | null): string {
  if (!url?.trim()) return '';
  try { return new URL(url.trim(), 'https://menrush.com').pathname; }
  catch { return ''; }
}

export function isPlaceholderAvatar(url?: string | null): boolean {
  return !url?.trim() || profileMediaPath(url).startsWith('/avatars/');
}
