/**
 * Who is inside a chat room right now (open socket), not who ever joined.
 * In-memory: one Node process, same as Socket.IO rooms.
 */

const present = new Map<string, Set<string>>();

export function noteRoomEnter(roomId: string, userId: string): number {
  let set = present.get(roomId);
  if (!set) {
    set = new Set();
    present.set(roomId, set);
  }
  set.add(userId);
  return set.size;
}

export function noteRoomExit(roomId: string, userId: string): number {
  const set = present.get(roomId);
  if (!set) return 0;
  set.delete(userId);
  if (set.size === 0) present.delete(roomId);
  return set.size;
}

export function liveRoomCount(roomId: string): number {
  return present.get(roomId)?.size ?? 0;
}

export function applyLiveRoomCounts<T extends { id: string; member_count: number }>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row, member_count: liveRoomCount(row.id) }));
}
