/** Stable marker so room attach can send an image over text-only room_messages. */
export const ROOM_IMAGE_PREFIX = '[[mr-img:';
export const ROOM_IMAGE_SUFFIX = ']]';

const ROOM_IMAGE_RE = /^\[\[mr-img:(.+?)\]\](?:\n([\s\S]*))?$/;

export function encodeRoomImageMessage(publicUrl: string, caption = ''): string {
  const url = publicUrl.trim();
  const trimmedCaption = caption.trim();
  return trimmedCaption
    ? `${ROOM_IMAGE_PREFIX}${url}${ROOM_IMAGE_SUFFIX}\n${trimmedCaption}`
    : `${ROOM_IMAGE_PREFIX}${url}${ROOM_IMAGE_SUFFIX}`;
}

export function parseRoomImageMessage(
  message: string,
): { url: string; caption: string } | null {
  const match = ROOM_IMAGE_RE.exec(message);
  if (!match) return null;
  const url = match[1]?.trim();
  if (!url || !url.startsWith('/uploads/')) return null;
  return { url, caption: (match[2] ?? '').trim() };
}
