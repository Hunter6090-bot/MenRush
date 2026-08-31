/** Dropped WebRTC / silent disconnect — clear the tile within a few seconds. */
export const ROOM_DROP_TIMEOUT_MS = 4000;

export const ROOM_ANON_NAME = 'Member';

export type RoomPresenceEntry = {
  user_id: string;
  name: string;
  photo_url?: string | null;
  isLive?: boolean;
  isSelf?: boolean;
  isMuted?: boolean;
};

export function isLiveInRoom<T extends { isLive?: boolean }>(participant: T): boolean {
  return participant.isLive !== false;
}

export function liveRoomParticipants<T extends { isLive?: boolean }>(participants: T[]): T[] {
  return participants.filter(isLiveInRoom);
}

export function liveOccupancy<T extends { isLive?: boolean }>(participants: T[]): number {
  return liveRoomParticipants(participants).length;
}

export function dropRoomParticipant<T extends { user_id: string }>(
  list: T[],
  userId: string,
): T[] {
  return list.filter((p) => p.user_id !== userId);
}

export function mergePresenceJoin<T extends RoomPresenceEntry>(list: T[], entry: T): T[] {
  const nextEntry = { ...entry, isLive: true as const };
  const idx = list.findIndex((p) => p.user_id === entry.user_id);
  if (idx === -1) return [...list, nextEntry];
  const next = [...list];
  next[idx] = { ...next[idx], ...nextEntry };
  return next;
}

/** Replace the live roster. Stale tiles (people not in this snapshot) are dropped. */
export function replacePresenceRoster<T extends RoomPresenceEntry>(
  incoming: T[],
  keepSelf?: T,
): T[] {
  const byId = new Map<string, T>();
  for (const entry of incoming) {
    byId.set(entry.user_id, { ...entry, isLive: true });
  }
  if (keepSelf && !byId.has(keepSelf.user_id)) {
    byId.set(keepSelf.user_id, { ...keepSelf, isLive: true, isSelf: true });
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
