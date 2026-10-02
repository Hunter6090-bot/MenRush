/**
 * ICE servers for WebRTC.
 *
 * CRITICAL: Metered free Open Relay's public static secret no longer yields
 * usable relay candidates (0 relay in real ICE gather tests). Production
 * must use a real provider:
 *
 *   METERED_DOMAIN + METERED_API_KEY
 *     → GET https://{domain}.metered.live/api/v1/turn/credentials?apiKey=…
 *     (free 20GB/mo — create at https://dashboard.metered.ca)
 *
 *   or TURN_URL + TURN_SECRET (TURN-REST HMAC)
 *   or TURN_URL + TURN_USERNAME + TURN_CREDENTIAL
 *
 * Without one of the above, only STUN is returned and phone↔Wi‑Fi calls
 * stay stuck on "waiting for his video".
 */
import crypto from 'crypto';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** TURN REST username/credential (draft-uberti-behave-turn-rest). */
export function createTurnRestCredentials(
  secret: string,
  ttlSeconds = 6 * 60 * 60,
): { username: string; credential: string } {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:menrush`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

function stunServers(): IceServerConfig[] {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
}

function prioritizeTurnUrls(urls: string[]): string[] {
  const score = (u: string) => {
    const x = u.toLowerCase();
    if (x.startsWith('turns:') && x.includes('transport=tcp')) return 0;
    if (x.startsWith('turns:')) return 1;
    if (x.includes('443') && x.includes('transport=tcp')) return 2;
    if (x.includes('443')) return 3;
    if (x.includes('transport=tcp')) return 4;
    return 5;
  };
  return [...urls].sort((a, b) => score(a) - score(b));
}

function parseTurnUrls(turnUrl: string): string[] {
  return turnUrl
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^turns?:/i.test(entry));
}

function turnIceServers(
  urls: string[],
  auth: { username: string; credential: string },
): IceServerConfig[] {
  const ordered = prioritizeTurnUrls(urls);
  if (!ordered.length) return [];
  const out: IceServerConfig[] = [];
  const tls = ordered.find((u) => u.toLowerCase().startsWith('turns:'));
  if (tls) out.push({ urls: tls, ...auth });
  out.push({ urls: ordered, ...auth });
  return out;
}

/**
 * Free Metered Open Relay via their REST API (needs free dashboard API key).
 * Returns full iceServers array from Metered, or null if not configured / failed.
 */
async function fetchMeteredOpenRelay(): Promise<IceServerConfig[] | null> {
  const apiKey = process.env.METERED_API_KEY?.trim() || process.env.METERED_TURN_API_KEY?.trim();
  const domain = (process.env.METERED_DOMAIN?.trim() || process.env.METERED_APP_NAME?.trim() || '').replace(
    /\.metered\.live$/i,
    '',
  );
  if (!apiKey || !domain) return null;

  const url = `https://${domain}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      console.error('[webrtc] Metered credentials HTTP', res.status);
      return null;
    }
    const data = (await res.json()) as IceServerConfig[] | { iceServers?: IceServerConfig[] };
    const list = Array.isArray(data) ? data : data.iceServers;
    if (!list?.length) {
      console.error('[webrtc] Metered credentials empty');
      return null;
    }
    console.log('[webrtc] ICE: Metered Open Relay REST API (', list.length, 'entries)');
    return list;
  } catch (err) {
    console.error('[webrtc] Metered credentials fetch failed:', err);
    return null;
  }
}

function envTurnServers(): IceServerConfig[] | null {
  const turnUrl = process.env.TURN_URL?.trim();
  if (!turnUrl) return null;
  const urls = parseTurnUrls(turnUrl);
  if (!urls.length) return null;

  // Ignore the known-dead public Open Relay static secret when used alone —
  // it produces 0 relay candidates (see docs/turn-provider-decision.md).
  const secret = process.env.TURN_SECRET?.trim();
  if (secret && secret !== 'openrelayprojectsecret') {
    const auth = createTurnRestCredentials(secret);
    console.log('[webrtc] ICE: STUN + TURN REST (TURN_URL + TURN_SECRET)');
    return turnIceServers(urls, auth);
  }

  const username = process.env.TURN_USERNAME?.trim();
  const credential = process.env.TURN_CREDENTIAL?.trim();
  if (username && credential && username !== 'openrelayproject') {
    console.log('[webrtc] ICE: STUN + TURN long-lived credentials');
    return turnIceServers(urls, { username, credential });
  }

  if (secret === 'openrelayprojectsecret' || username === 'openrelayproject') {
    console.warn(
      '[webrtc] Ignoring public Open Relay static secret (0 relay candidates). ' +
        'Set METERED_DOMAIN + METERED_API_KEY from https://dashboard.metered.ca',
    );
  }
  return null;
}

/** Sync entry used by Express — may include only STUN if async Metered not warmed. */
let cachedMetered: { at: number; servers: IceServerConfig[] } | null = null;
const METERED_CACHE_MS = 5 * 60 * 1000;

export async function getIceServersAsync(): Promise<IceServerConfig[]> {
  const stun = stunServers();
  const fromEnv = envTurnServers();
  if (fromEnv) return [...stun, ...fromEnv];

  const now = Date.now();
  if (cachedMetered && now - cachedMetered.at < METERED_CACHE_MS) {
    return [...stun, ...cachedMetered.servers];
  }

  const metered = await fetchMeteredOpenRelay();
  if (metered) {
    cachedMetered = { at: now, servers: metered };
    // Metered payload already includes STUN+TURN; don't double STUN if present.
    const hasStun = metered.some((s) => {
      const u = Array.isArray(s.urls) ? s.urls.join(',') : String(s.urls || '');
      return u.includes('stun:');
    });
    return hasStun ? metered : [...stun, ...metered];
  }

  console.error(
    '[webrtc] NO WORKING TURN — video calls will fail across networks. ' +
      'Set METERED_DOMAIN + METERED_API_KEY (free) or TURN_URL + TURN_SECRET (paid).',
  );
  return stun;
}

/** Sync wrapper for routes that cannot await (warm cache on boot). */
export function getIceServers(): IceServerConfig[] {
  const stun = stunServers();
  const fromEnv = envTurnServers();
  if (fromEnv) return [...stun, ...fromEnv];
  if (cachedMetered) {
    const hasStun = cachedMetered.servers.some((s) => {
      const u = Array.isArray(s.urls) ? s.urls.join(',') : String(s.urls || '');
      return u.includes('stun:');
    });
    return hasStun ? cachedMetered.servers : [...stun, ...cachedMetered.servers];
  }
  // Kick off background warm; this request may still be STUN-only.
  void getIceServersAsync().catch(() => undefined);
  console.warn('[webrtc] ICE: STUN only this request (Metered cache cold or unset)');
  return stun;
}

/** Call once at server boot so first call is not STUN-only. */
export function warmIceServers(): void {
  void getIceServersAsync().catch(() => undefined);
}
