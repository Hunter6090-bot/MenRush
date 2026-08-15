/**
 * ICE server list for WebRTC.
 *
 * iOS Safari often only exposes mDNS host candidates → needs TURN for any
 * real-world call (phone data ↔ home Wi‑Fi, etc.).
 *
 * Env (Railway):
 *   TURN_URL     comma-separated turn:/turns: URLs
 *   TURN_SECRET  static-auth HMAC secret (TURN REST) — preferred
 *   or TURN_USERNAME + TURN_CREDENTIAL for long-lived auth
 *
 * Prefer TURNS (TLS 443) first — mobile carriers often block UDP 3478.
 */
import crypto from 'crypto';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const OPEN_RELAY_STATIC_SECRET = 'openrelayprojectsecret';

/** Reliable free fallback (Metered Open Relay static-auth). TLS first for mobile. */
const OPEN_RELAY_URLS = [
  'turns:staticauth.openrelay.metered.ca:443?transport=tcp',
  'turns:staticauth.openrelay.metered.ca:443',
  'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
  'turn:staticauth.openrelay.metered.ca:443',
  'turn:staticauth.openrelay.metered.ca:80?transport=tcp',
  'turn:staticauth.openrelay.metered.ca:80',
];

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

/** Prefer TLS/TCP TURN URLs first — better on mobile carrier networks. */
function prioritizeTurnUrls(urls: string[]): string[] {
  const score = (u: string) => {
    const x = u.toLowerCase();
    if (x.startsWith('turns:') && x.includes('transport=tcp')) return 0;
    if (x.startsWith('turns:')) return 1;
    if (x.startsWith('turn:') && x.includes('443') && x.includes('transport=tcp')) return 2;
    if (x.startsWith('turn:') && x.includes('443')) return 3;
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

/**
 * Browsers are happier with one URL per iceServer entry for TURN, plus a
 * bundled entry — we emit both: multi-url (compact) and first TLS url alone.
 */
function turnIceServers(
  urls: string[],
  auth: { username: string; credential: string },
): IceServerConfig[] {
  const ordered = prioritizeTurnUrls(urls);
  if (!ordered.length) return [];
  const out: IceServerConfig[] = [
    // Primary: full list (Chrome)
    { urls: ordered, ...auth },
  ];
  // iOS Safari often locks onto the first entry — give it a TLS-only server first.
  const tls = ordered.find((u) => u.toLowerCase().startsWith('turns:'));
  if (tls) {
    out.unshift({ urls: tls, ...auth });
  }
  return out;
}

export function getIceServers(): IceServerConfig[] {
  const servers = stunServers();

  const turnUrl = process.env.TURN_URL?.trim();
  if (turnUrl) {
    const urls = parseTurnUrls(turnUrl);
    if (!urls.length) {
      console.warn(
        '[webrtc] TURN_URL set but no valid turn:/turns: URLs found — using Open Relay fallback',
      );
    } else {
      const secret = process.env.TURN_SECRET?.trim();
      if (secret) {
        const auth = createTurnRestCredentials(secret);
        servers.push(...turnIceServers(urls, auth));
        console.log('[webrtc] ICE: STUN + TURN REST (TURN_URL + TURN_SECRET)');
        return servers;
      }

      const username = process.env.TURN_USERNAME?.trim();
      const credential = process.env.TURN_CREDENTIAL?.trim();
      if (username && credential) {
        servers.push(...turnIceServers(urls, { username, credential }));
        console.log('[webrtc] ICE: STUN + TURN long-lived credentials');
        return servers;
      }

      console.warn(
        '[webrtc] TURN_URL is set but TURN_SECRET (or TURN_USERNAME+TURN_CREDENTIAL) is missing; using STUN only',
      );
      return servers;
    }
  }

  // Default: Metered Open Relay static-auth (HMAC).
  const auth = createTurnRestCredentials(OPEN_RELAY_STATIC_SECRET);
  servers.push(...turnIceServers(OPEN_RELAY_URLS, auth));
  console.log('[webrtc] ICE: STUN + Open Relay TURN (default static-auth)');

  return servers;
}
