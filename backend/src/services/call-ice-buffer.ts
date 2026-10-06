/**
 * Holds a caller's ICE candidates that reach the server before the callee can
 * receive them: the callee is offline / cold-starting from a push, and the
 * pending call record does not exist yet (call:initiate is still awaiting its
 * auth lookup and the offline grace wait).
 *
 * Dropping these left the callee with an offer but none of the caller's
 * candidates. Across networks that means no TURN permission and no NAT pinhole
 * for the caller, so ICE never completes and remote video stays black (#73).
 */
const EARLY_ICE_TTL_MS = 60_000;
const EARLY_ICE_MAX_PER_CALL = 128;

interface EarlyIceEntry {
  at: number;
  candidates: unknown[];
}

export class EarlyCallIceBuffer {
  private entries = new Map<string, EarlyIceEntry>();

  private key(callerId: string, calleeId: string) {
    return `${callerId}:${calleeId}`;
  }

  push(callerId: string, calleeId: string, candidate: unknown, now = Date.now()): void {
    this.prune(now);
    const key = this.key(callerId, calleeId);
    const entry = this.entries.get(key) ?? { at: now, candidates: [] };
    if (entry.candidates.length >= EARLY_ICE_MAX_PER_CALL) return;
    entry.candidates.push(candidate);
    this.entries.set(key, entry);
  }

  /** Remove and return everything buffered for this caller → callee pair. */
  take(callerId: string, calleeId: string, now = Date.now()): unknown[] {
    this.prune(now);
    const key = this.key(callerId, calleeId);
    const entry = this.entries.get(key);
    this.entries.delete(key);
    return entry?.candidates ?? [];
  }

  clear(callerId: string, calleeId: string): void {
    this.entries.delete(this.key(callerId, calleeId));
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (now - entry.at > EARLY_ICE_TTL_MS) this.entries.delete(key);
    }
  }
}
