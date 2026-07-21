/**
 * ICE server list for WebRTC. STUN alone is enough on the same LAN when peers
 * advertise routable host candidates (typical Android Chrome). iOS Safari only
 * advertises mDNS `.local` hosts, so iPhone↔iPhone / cross-NAT needs TURN.
 *
 * Railway (production) — set explicitly (defaults match Open Relay if unset):
 *   TURN_URL=turn:staticauth.openrelay.metered.ca:80,turn:staticauth.openrelay.metered.ca:443,turn:staticauth.openrelay.metered.ca:443?transport=tcp,turns:staticauth.openrelay.metered.ca:443
 *   TURN_SECRET=openrelayprojectsecret
 * Or a paid Metered/Twilio relay:
 *   TURN_URL        comma-separated turn:/turns: URLs
 *   TURN_SECRET     static-auth HMAC secret (TURN REST) — preferred
 *   TURN_USERNAME + TURN_CREDENTIAL  long-lived user/pass (if provider does not use REST)
 *
 * Default fallback: Metered Open Relay static-auth
 *   host  staticauth.openrelay.metered.ca
 *   secret openrelayprojectsecret
 * (legacy openrelayproject / openrelayproject password auth is dead.)
 */
import crypto from 'crypto';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const OPEN_RELAY_STATIC_SECRET = 'openrelayprojectsecret';
const OPEN_RELAY_URLS = [
  'turn:staticauth.openrelay.metered.ca:80',
  'turn:staticauth.openrelay.metered.ca:443',
  'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
  'turns:staticauth.openrelay.metered.ca:443',
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
    // Open Relay STUN (helps when Google STUN is blocked).
    { urls: 'stun:openrelay.metered.ca:80' },
  ];
}

function parseTurnUrls(turnUrl: string): string | string[] {
  return turnUrl.includes(',')
    ? turnUrl.split(',').map((entry) => entry.trim()).filter(Boolean)
    : turnUrl;
}

export function getIceServers(): IceServerConfig[] {
  const servers = stunServers();

  const turnUrl = process.env.TURN_URL?.trim();
  if (turnUrl) {
    const urls = parseTurnUrls(turnUrl);
    const secret = process.env.TURN_SECRET?.trim();

    if (secret) {
      const { username, credential } = createTurnRestCredentials(secret);
      servers.push({ urls, username, credential });
      console.log('[webrtc] ICE: STUN + TURN REST (TURN_URL + TURN_SECRET)');
      return servers;
    }

    const username = process.env.TURN_USERNAME?.trim();
    const credential = process.env.TURN_CREDENTIAL?.trim();
    if (username && credential) {
      servers.push({ urls, username, credential });
      console.log('[webrtc] ICE: STUN + TURN long-lived credentials');
      return servers;
    }

    // Misconfigured TURN_URL without creds — keep STUN so same-LAN host candidates still work.
    console.warn(
      '[webrtc] TURN_URL is set but TURN_SECRET (or TURN_USERNAME+TURN_CREDENTIAL) is missing; using STUN only',
    );
    return servers;
  }

  // Default: Metered Open Relay static-auth (HMAC), not the retired openrelayproject password.
  const { username, credential } = createTurnRestCredentials(OPEN_RELAY_STATIC_SECRET);
  servers.push({
    urls: OPEN_RELAY_URLS,
    username,
    credential,
  });
  console.log('[webrtc] ICE: STUN + Open Relay TURN (default static-auth)');

  return servers;
}
