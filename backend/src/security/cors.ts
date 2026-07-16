const LOCALHOST_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/;
const PRIVATE_LAN_ORIGIN =
  /^https?:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

function isDevTunnelOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.trycloudflare.com') || hostname.endsWith('.ngrok-free.app');
  } catch {
    return false;
  }
}

const PRODUCTION_FRONTENDS = new Set([
  'https://menrush.com',
  'https://www.menrush.com',
  'https://nearnow-frontend.vercel.app',
  'https://menrush-hunter6090-bots-projects.vercel.app',
]);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (LOCALHOST_ORIGIN.test(origin)) return true;

  const explicit = process.env.FRONTEND_URL?.replace(/\/$/, '');
  if (explicit && origin === explicit) return true;

  // www / bare domain and known Vercel production aliases.
  if (PRODUCTION_FRONTENDS.has(origin)) return true;
  // Preview deploys: menrush-*.vercel.app
  try {
    const { hostname } = new URL(origin);
    if (
      hostname === 'menrush.com' ||
      hostname.endsWith('.menrush.com') ||
      (hostname.startsWith('menrush-') && hostname.endsWith('.vercel.app'))
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }

  if (process.env.NODE_ENV !== 'production') {
    if (PRIVATE_LAN_ORIGIN.test(origin) || isDevTunnelOrigin(origin)) return true;
  }

  return false;
}

export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (isAllowedOrigin(origin)) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
}
