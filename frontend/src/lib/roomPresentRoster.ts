/**
 * Present occupancy for the in-room side list.
 * Same source as live presence-sync: who is in the room RIGHT NOW.
 * Does not seed from historical DB membership.
 */

export type PresentPerson = {
  user_id: string;
  name: string;
  photo_url?: string | null;
};

export function replacePresentRoster(
  list: Array<{ user_id: string; name: string; photo_url?: string | null }>,
): PresentPerson[] {
  const byId = new Map<string, PresentPerson>();
  for (const entry of list) {
    if (!entry?.user_id) continue;
    byId.set(entry.user_id, {
      user_id: entry.user_id,
      name: entry.name || 'Member',
      photo_url: entry.photo_url ?? null,
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertPresentPerson(
  prev: PresentPerson[],
  entry: { user_id: string; name?: string; photo_url?: string | null },
): PresentPerson[] {
  const next = prev.filter((p) => p.user_id !== entry.user_id);
  next.push({
    user_id: entry.user_id,
    name: entry.name || 'Member',
    photo_url: entry.photo_url ?? null,
  });
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function removePresentPerson(prev: PresentPerson[], userId: string): PresentPerson[] {
  return prev.filter((p) => p.user_id !== userId);
}

/** Side list excludes self. */
export function presentOthers(roster: PresentPerson[], selfId?: string | null): PresentPerson[] {
  if (!selfId) return roster;
  return roster.filter((p) => p.user_id !== selfId);
}
