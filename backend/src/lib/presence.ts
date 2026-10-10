/** Pete lock: members stay live for 1 hour after last activity / leaving. */
export const PRESENCE_WINDOW_SQL = "INTERVAL '1 hour'";

/**
 * Nearby "online" is last_seen within the presence window.
 * Socket `profiles.online` is not required — disconnect still shows live until the hour ends.
 */
export const PRESENCE_LIVE_SQL = `(p.last_seen IS NOT NULL AND p.last_seen > NOW() - ${PRESENCE_WINDOW_SQL})`;
