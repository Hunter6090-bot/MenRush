/**
 * Local credential store. Secrets never leave this machine via MenRush APIs.
 * File: social-studio/.data/connections.json
 *
 * Keys are entered only via the Connections UI. Never read repo-root env files
 * (including `.env.menrush-social`), never dotenv them, never copy into code.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '.data');
const STORE_PATH = path.join(DATA_DIR, 'connections.json');

/** Refuse any path outside social-studio/.data/ — blocks accidental env imports. */
function assertDataPath(target) {
  const resolved = path.resolve(target);
  const root = path.resolve(DATA_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Refusing to read/write credentials outside social-studio/.data/');
  }
}

export const PLATFORMS = ['x', 'instagram', 'reddit', 'bluesky', 'threads'];

/** Field definitions shown on Connections cards (exact product copy). */
export const PLATFORM_FIELDS = {
  x: {
    label: 'X',
    help: 'developer.x.com → your app → Keys and tokens. Leave Bearer Token / Application-Only out. OAuth 1.0a User Context only (can tweet).',
    fields: [
      { key: 'apiKey', label: 'API Key' },
      { key: 'apiKeySecret', label: 'API Key Secret' },
      { key: 'accessToken', label: 'Access Token' },
      { key: 'accessTokenSecret', label: 'Access Token Secret' },
    ],
  },
  instagram: {
    label: 'Instagram',
    help: 'Graph API, professional account. Long-lived Page / Instagram token + numeric IG user id.',
    fields: [
      { key: 'accessToken', label: 'Access token' },
      { key: 'igUserId', label: 'IG user id' },
    ],
  },
  reddit: {
    label: 'Reddit',
    help: 'Script app at https://www.reddit.com/prefs/apps. Subreddit blank = profile.',
    fields: [
      { key: 'clientId', label: 'Client id' },
      { key: 'clientSecret', label: 'Client secret' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password of the posting account' },
      { key: 'subreddit', label: 'Subreddit (optional)', optional: true },
    ],
  },
  bluesky: {
    label: 'Bluesky',
    help: 'Settings → App passwords. Handle e.g. menrush.bsky.social. App password — not login password.',
    fields: [
      { key: 'handle', label: 'Handle' },
      { key: 'appPassword', label: 'App password' },
    ],
  },
  threads: {
    label: 'Threads',
    help: 'Threads Graph API. Long-lived access token + numeric Threads user id.',
    fields: [
      { key: 'accessToken', label: 'Access token' },
      { key: 'threadsUserId', label: 'Threads user id' },
    ],
  },
};

function emptyConnection(platform) {
  const fields = {};
  for (const f of PLATFORM_FIELDS[platform].fields) {
    fields[f.key] = '';
  }
  return {
    platform,
    enabled: false,
    verified: false,
    verifiedAt: null,
    verifiedAs: null,
    lastVerifyError: null,
    fields,
  };
}

function defaultStore() {
  const connections = {};
  for (const p of PLATFORMS) {
    connections[p] = emptyConnection(p);
  }
  return { version: 1, connections };
}

function ensureDataDir() {
  assertDataPath(DATA_DIR);
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadStore() {
  ensureDataDir();
  assertDataPath(STORE_PATH);
  if (!fs.existsSync(STORE_PATH)) {
    const fresh = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(fresh, null, 2), { mode: 0o600 });
    return fresh;
  }
  const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  const base = defaultStore();
  for (const p of PLATFORMS) {
    if (raw.connections?.[p]) {
      base.connections[p] = {
        ...emptyConnection(p),
        ...raw.connections[p],
        fields: { ...emptyConnection(p).fields, ...raw.connections[p].fields },
      };
    }
  }
  return base;
}

export function saveStore(store) {
  ensureDataDir();
  assertDataPath(STORE_PATH);
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

/** Mask secrets for API responses — never echo plaintext secrets. */
export function maskValue(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

export function publicConnection(conn) {
  const meta = PLATFORM_FIELDS[conn.platform];
  const fields = {};
  for (const f of meta.fields) {
    const v = conn.fields[f.key] || '';
    fields[f.key] = {
      label: f.label,
      optional: Boolean(f.optional),
      set: Boolean(v),
      masked: v ? maskValue(v) : '',
    };
  }
  return {
    platform: conn.platform,
    label: meta.label,
    help: meta.help,
    enabled: Boolean(conn.enabled),
    verified: Boolean(conn.verified),
    verifiedAt: conn.verifiedAt,
    verifiedAs: conn.verifiedAs,
    lastVerifyError: conn.lastVerifyError,
    fields,
  };
}

export function getSecrets(platform) {
  const store = loadStore();
  return store.connections[platform]?.fields || {};
}

export function updateConnection(platform, { enabled, fields }) {
  if (!PLATFORMS.includes(platform)) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  const store = loadStore();
  const conn = store.connections[platform];
  if (typeof enabled === 'boolean') {
    conn.enabled = enabled;
  }
  if (fields && typeof fields === 'object') {
    let changed = false;
    for (const f of PLATFORM_FIELDS[platform].fields) {
      if (Object.prototype.hasOwnProperty.call(fields, f.key)) {
        const next = String(fields[f.key] ?? '').trim();
        // Empty string means "leave existing" when field already set (masked UI).
        if (next === '' && conn.fields[f.key]) continue;
        if (next !== conn.fields[f.key]) {
          conn.fields[f.key] = next;
          changed = true;
        }
      }
    }
    if (changed) {
      conn.verified = false;
      conn.verifiedAt = null;
      conn.verifiedAs = null;
      conn.lastVerifyError = null;
    }
  }
  saveStore(store);
  return store.connections[platform];
}

export function markVerified(platform, { ok, as, error }) {
  const store = loadStore();
  const conn = store.connections[platform];
  if (ok) {
    conn.verified = true;
    conn.verifiedAt = new Date().toISOString();
    conn.verifiedAs = as || null;
    conn.lastVerifyError = null;
  } else {
    conn.verified = false;
    conn.verifiedAt = null;
    conn.verifiedAs = null;
    conn.lastVerifyError = error || 'Verify failed';
  }
  saveStore(store);
  return conn;
}

export function storePath() {
  return STORE_PATH;
}
