/**
 * ICE server list for WebRTC. STUN alone is enough on the same LAN when peers
 * advertise routable host candidates (typical Android Chrome). iOS Safari only
 * advertises mDNS `.local` hosts, so iPhone↔iPhone needs a working TURN relay
 * even on the same Wi‑Fi.
 *
 * The old Metered static user/pass (`openrelayproject`) no longer authenticates.
 * Use TURN REST (time-limited HMAC) against `staticauth.openrelay.metered.ca`,
 * or set TURN_URL + TURN_USERNAME + TURN_CREDENTIAL / TURN_SECRET.
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
  ];
}

export function getIceServers(): IceServerConfig[] {
  const servers = stunServers();

  const turnUrl = process.env.TURN_URL?.trim();
  if (turnUrl) {
    const secret = process.env.TURN_SECRET?.trim();
    const urls = turnUrl.includes(',')
      ? turnUrl.split(',').map((entry) => entry.trim()).filter(Boolean)
      : turnUrl;

    if (secret) {
      const { username, credential } = createTurnRestCredentials(secret);
      servers.push({ urls, username, credential });
      return servers;
    }

    servers.push({
      urls,
      username: process.env.TURN_USERNAME || undefined,
      credential: process.env.TURN_CREDENTIAL || undefined,
    });
    return servers;
  }

  // Default: Metered Open Relay static-auth (HMAC), not the retired openrelayproject password.
  const { username, credential } = createTurnRestCredentials(OPEN_RELAY_STATIC_SECRET);
  servers.push({
    urls: OPEN_RELAY_URLS,
    username,
    credential,
  });

  return servers;
}
