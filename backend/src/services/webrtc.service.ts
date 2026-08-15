/**
 * ICE server list for WebRTC.
 *
 * Screenshot diagnosis (BOA↔Bigbear): local camera works, remote stuck on
 * "waiting for his video" = signalling OK, media/ICE path failed. Phones
 * need working TURN (TLS/TCP preferred).
 *
 * Env (Railway):
 *   TURN_URL     comma-separated turn:/turns: URLs
 *   TURN_SECRET  static-auth HMAC secret (TURN REST) — preferred
 *   or TURN_USERNAME + TURN_CREDENTIAL for long-lived auth
 *
 * Free Open Relay: we emit BOTH TURN REST (staticauth host) and the legacy
 * username/password pair — browsers try all; one path often succeeds where
 * the other fails.
 */
import crypto from 'crypto';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const OPEN_RELAY_STATIC_SECRET = 'openrelayprojectsecret';

/** TLS/TCP first — mobile carriers often block UDP 3478. */
const OPEN_RELAY_STATIC_URLS = [
  'turns:staticauth.openrelay.metered.ca:443?transport=tcp',
  'turns:staticauth.openrelay.metered.ca:443',
  'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
  'turn:staticauth.openrelay.metered.ca:443',
  'turn:staticauth.openrelay.metered.ca:80?transport=tcp',
  'turn:staticauth.openrelay.metered.ca:80',
];

/** Legacy Open Relay password auth (still widely documented). */
const OPEN_RELAY_LEGACY_URLS = [
  'turns:openrelay.metered.ca:443?transport=tcp',
  'turn:openrelay.metered.ca:443?transport=tcp',
  'turn:openrelay.metered.ca:443',
  'turn:openrelay.metered.ca:80?transport=tcp',
  'turn:openrelay.metered.ca:80',
];

/** TURN REST username/credential (draft-uberti-behave-turn-rest). */
export function createTurnRestCredentials(
  secret: string,
  ttlSeconds = 6 * 60 * 60,
): { username: string; credential: string } {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  // Metered/Nextcloud static-auth: username is often just the expiry, and also
  // expiry:userid. Emit both as separate iceServer entries from the caller.
  const username = `${expiry}:menrush`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

function createTurnRestCredentialsExpiryOnly(
  secret: string,
  ttlSeconds = 6 * 60 * 60,
): { username: string; credential: string } {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = String(expiry);
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

function turnIceServers(
  urls: string[],
  auth: { username: string; credential: string },
): IceServerConfig[] {
  const ordered = prioritizeTurnUrls(urls);
  if (!ordered.length) return [];
  const out: IceServerConfig[] = [];
  const tls = ordered.find((u) => u.toLowerCase().startsWith('turns:'));
  // Safari: first entry matters — put a single TLS URL first.
  if (tls) out.push({ urls: tls, ...auth });
  out.push({ urls: ordered, ...auth });
  return out;
}

function openRelayFallbackServers(): IceServerConfig[] {
  const secret = OPEN_RELAY_STATIC_SECRET;
  const restUser = createTurnRestCredentials(secret);
  const restExpiry = createTurnRestCredentialsExpiryOnly(secret);
  return [
    ...turnIceServers(OPEN_RELAY_STATIC_URLS, restUser),
    ...turnIceServers(OPEN_RELAY_STATIC_URLS, restExpiry),
    // Legacy password auth on openrelay.metered.ca (may fail DNS in some regions).
    {
      urls: OPEN_RELAY_LEGACY_URLS,
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
}

export function getIceServers(): IceServerConfig[] {
  const servers = stunServers();

  const turnUrl = process.env.TURN_URL?.trim();
  if (turnUrl) {
    const urls = parseTurnUrls(turnUrl);
    if (urls.length) {
      const secret = process.env.TURN_SECRET?.trim();
      if (secret) {
        // Dual username formats for static-auth compatibility.
        servers.push(...turnIceServers(urls, createTurnRestCredentials(secret)));
        servers.push(...turnIceServers(urls, createTurnRestCredentialsExpiryOnly(secret)));
        // Always also offer free Open Relay as backup when using custom TURN.
        if (!turnUrl.includes('openrelay') && !turnUrl.includes('staticauth')) {
          servers.push(...openRelayFallbackServers());
        }
        console.log('[webrtc] ICE: STUN + TURN REST (TURN_URL + TURN_SECRET) + dual auth formats');
        return servers;
      }

      const username = process.env.TURN_USERNAME?.trim();
      const credential = process.env.TURN_CREDENTIAL?.trim();
      if (username && credential) {
        servers.push(...turnIceServers(urls, { username, credential }));
        servers.push(...openRelayFallbackServers());
        console.log('[webrtc] ICE: STUN + TURN long-lived credentials');
        return servers;
      }

      console.warn(
        '[webrtc] TURN_URL is set but TURN_SECRET (or TURN_USERNAME+TURN_CREDENTIAL) is missing; Open Relay fallback',
      );
    }
  }

  servers.push(...openRelayFallbackServers());
  console.log('[webrtc] ICE: STUN + Open Relay TURN (REST dual + legacy password)');
  return servers;
}
