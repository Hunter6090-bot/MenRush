/**
 * Ephemeral in-room 1:1 sessions.
 * Lives only while both people are in the group room socket.
 * Never persisted to DB / never touches global Chat messages.
 */

export type RoomDmSession = {
  roomId: string;
  a: string;
  b: string;
};

export function roomDmSessionKey(roomId: string, userA: string, userB: string): string {
  const [x, y] = [userA, userB].sort();
  return `${roomId}:${x}:${y}`;
}

export function peerOfSession(session: RoomDmSession, userId: string): string | null {
  if (session.a === userId) return session.b;
  if (session.b === userId) return session.a;
  return null;
}

export class RoomDmSessionStore {
  private sessions = new Map<string, RoomDmSession>();

  open(roomId: string, userA: string, userB: string): RoomDmSession {
    const key = roomDmSessionKey(roomId, userA, userB);
    const existing = this.sessions.get(key);
    if (existing) return existing;
    const [a, b] = [userA, userB].sort();
    const session: RoomDmSession = { roomId, a, b };
    this.sessions.set(key, session);
    return session;
  }

  get(roomId: string, userA: string, userB: string): RoomDmSession | undefined {
    return this.sessions.get(roomDmSessionKey(roomId, userA, userB));
  }

  close(roomId: string, userA: string, userB: string): RoomDmSession | undefined {
    const key = roomDmSessionKey(roomId, userA, userB);
    const session = this.sessions.get(key);
    if (!session) return undefined;
    this.sessions.delete(key);
    return session;
  }

  /** End every 1:1 in this room that involves userId (they left the group). */
  endAllForUserInRoom(roomId: string, userId: string): RoomDmSession[] {
    const ended: RoomDmSession[] = [];
    for (const [key, session] of this.sessions) {
      if (session.roomId !== roomId) continue;
      if (session.a !== userId && session.b !== userId) continue;
      this.sessions.delete(key);
      ended.push(session);
    }
    return ended;
  }

  size(): number {
    return this.sessions.size;
  }

  clear(): void {
    this.sessions.clear();
  }
}

/** Shared process-local store (Socket.IO handlers). */
export const roomDmSessions = new RoomDmSessionStore();
