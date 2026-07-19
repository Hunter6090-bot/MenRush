/**
 * ICE server list for WebRTC. STUN alone is enough on the same LAN; calls across
 * different networks usually need TURN to relay media through restrictive NATs.
 */
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function getIceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl = process.env.TURN_URL?.trim();
  if (turnUrl) {
    servers.push({
      urls: turnUrl.includes(',')
        ? turnUrl.split(',').map((entry) => entry.trim())
        : turnUrl,
      username: process.env.TURN_USERNAME || undefined,
      credential: process.env.TURN_CREDENTIAL || undefined,
    });
    return servers;
  }

  // Default relay for cross-network calls when no dedicated TURN is configured.
  // Set TURN_URL on the backend for production-scale traffic.
  servers.push({
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  });

  return servers;
}
