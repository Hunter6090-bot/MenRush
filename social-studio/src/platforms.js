/**
 * Platform verify + publish. All calls leave from this local process only.
 * Secrets are never logged and never sent to MenRush production.
 */

import crypto from 'node:crypto';
import OAuth from 'oauth-1.0a';
import { getSecrets } from './store.js';

const LOGO = 'https://menrush.com/menrush-logo.png';
const USER_AGENT = 'MenRushSocialStudio/1.0 (local; +https://menrush.com)';

function requireFields(secrets, keys) {
  const missing = keys.filter((k) => !secrets[k]?.trim());
  if (missing.length) {
    throw new Error(`Missing fields: ${missing.join(', ')}`);
  }
}

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _raw: text.slice(0, 200) };
  }
}

// ─── X (OAuth 1.0a User Context) ───────────────────────────────────────────

function xOAuth(secrets) {
  return new OAuth({
    consumer: { key: secrets.apiKey, secret: secrets.apiKeySecret },
    signature_method: 'HMAC-SHA1',
    hash_function(base, key) {
      return crypto.createHmac('sha1', key).update(base).digest('base64');
    },
  });
}

async function xRequest(secrets, method, url, data) {
  const oauth = xOAuth(secrets);
  const token = { key: secrets.accessToken, secret: secrets.accessTokenSecret };
  const reqData = { url, method };
  const authHeader = oauth.toHeader(oauth.authorize(reqData, token));
  const headers = {
    ...authHeader,
    'User-Agent': USER_AGENT,
  };
  let body;
  if (method === 'POST' && data) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(data).toString();
  }
  const res = await fetch(url, { method, headers, body });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json.errors?.[0]?.message || json.detail || json.title || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function verifyX() {
  const secrets = getSecrets('x');
  requireFields(secrets, ['apiKey', 'apiKeySecret', 'accessToken', 'accessTokenSecret']);
  const me = await xRequest(
    secrets,
    'GET',
    'https://api.twitter.com/1.1/account/verify_credentials.json?include_entities=false&skip_status=true',
  );
  return { as: me.screen_name ? `@${me.screen_name}` : String(me.id_str || me.id) };
}

export async function publishX(text) {
  const secrets = getSecrets('x');
  requireFields(secrets, ['apiKey', 'apiKeySecret', 'accessToken', 'accessTokenSecret']);
  // Prefer v2; fall back message if app only has v1.1 write.
  try {
    const oauth = xOAuth(secrets);
    const token = { key: secrets.accessToken, secret: secrets.accessTokenSecret };
    const url = 'https://api.twitter.com/2/tweets';
    const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'POST' }, token));
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ text }),
    });
    const json = await readJson(res);
    if (!res.ok) {
      throw new Error(json.detail || json.title || json.errors?.[0]?.message || `HTTP ${res.status}`);
    }
    return { externalId: json.data?.id || null };
  } catch (err) {
    // v1.1 fallback
    const json = await xRequest(secrets, 'POST', 'https://api.twitter.com/1.1/statuses/update.json', {
      status: text.slice(0, 280),
    });
    return { externalId: json.id_str || null };
  }
}

// ─── Instagram (Graph API) ─────────────────────────────────────────────────

export async function verifyInstagram() {
  const secrets = getSecrets('instagram');
  requireFields(secrets, ['accessToken', 'igUserId']);
  const url = new URL(`https://graph.facebook.com/v21.0/${secrets.igUserId}`);
  url.searchParams.set('fields', 'id,username,name');
  url.searchParams.set('access_token', secrets.accessToken);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(json.error?.message || `HTTP ${res.status}`);
  }
  return { as: json.username ? `@${json.username}` : json.id };
}

export async function publishInstagram(text) {
  const secrets = getSecrets('instagram');
  requireFields(secrets, ['accessToken', 'igUserId']);
  // Create image container with official logo, then publish.
  const createUrl = new URL(`https://graph.facebook.com/v21.0/${secrets.igUserId}/media`);
  createUrl.searchParams.set('image_url', LOGO);
  createUrl.searchParams.set('caption', text);
  createUrl.searchParams.set('access_token', secrets.accessToken);
  const createRes = await fetch(createUrl, { method: 'POST', headers: { 'User-Agent': USER_AGENT } });
  const createJson = await readJson(createRes);
  if (!createRes.ok) {
    throw new Error(createJson.error?.message || `Create media failed (${createRes.status})`);
  }
  const creationId = createJson.id;
  // Brief wait for container ready
  await new Promise((r) => setTimeout(r, 2000));
  const pubUrl = new URL(`https://graph.facebook.com/v21.0/${secrets.igUserId}/media_publish`);
  pubUrl.searchParams.set('creation_id', creationId);
  pubUrl.searchParams.set('access_token', secrets.accessToken);
  const pubRes = await fetch(pubUrl, { method: 'POST', headers: { 'User-Agent': USER_AGENT } });
  const pubJson = await readJson(pubRes);
  if (!pubRes.ok) {
    throw new Error(pubJson.error?.message || `Publish failed (${pubRes.status})`);
  }
  return { externalId: pubJson.id || creationId };
}

// ─── Reddit ────────────────────────────────────────────────────────────────

async function redditToken(secrets) {
  const basic = Buffer.from(`${secrets.clientId}:${secrets.clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'password',
    username: secrets.username,
    password: secrets.password,
  });
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
  });
  const json = await readJson(res);
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Reddit auth failed (${res.status})`);
  }
  return json.access_token;
}

export async function verifyReddit() {
  const secrets = getSecrets('reddit');
  requireFields(secrets, ['clientId', 'clientSecret', 'username', 'password']);
  const token = await redditToken(secrets);
  const res = await fetch('https://oauth.reddit.com/api/v1/me', {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return { as: json.name ? `u/${json.name}` : secrets.username };
}

export async function publishReddit(text) {
  const secrets = getSecrets('reddit');
  requireFields(secrets, ['clientId', 'clientSecret', 'username', 'password']);
  const token = await redditToken(secrets);
  let title = 'MenRush';
  let body = text;
  const titleMatch = text.match(/^Title:\s*(.+)$/im);
  const bodyMatch = text.match(/^Body:\s*([\s\S]*)$/im);
  if (titleMatch) title = titleMatch[1].trim().slice(0, 300);
  if (bodyMatch) body = bodyMatch[1].trim();
  else if (titleMatch) body = text.replace(/^Title:\s*.+$/im, '').trim();

  const sr = (secrets.subreddit || secrets.username || '').replace(/^r\//i, '').replace(/^u\//i, '');
  const form = new URLSearchParams({
    api_type: 'json',
    kind: 'self',
    sr: secrets.subreddit?.trim() ? sr : `u_${secrets.username}`,
    title,
    text: body,
  });
  // Profile posts use user subreddit u_username when subreddit blank
  if (!secrets.subreddit?.trim()) {
    form.set('sr', `u_${secrets.username}`);
  }

  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  const errors = json.json?.errors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.join(': ')).join('; '));
  }
  const id = json.json?.data?.id || json.json?.data?.name || null;
  return { externalId: id };
}

// ─── Bluesky ───────────────────────────────────────────────────────────────

async function blueskySession(secrets) {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({
      identifier: secrets.handle,
      password: secrets.appPassword,
    }),
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json;
}

export async function verifyBluesky() {
  const secrets = getSecrets('bluesky');
  requireFields(secrets, ['handle', 'appPassword']);
  const session = await blueskySession(secrets);
  return { as: session.handle || secrets.handle };
}

export async function publishBluesky(text) {
  const secrets = getSecrets('bluesky');
  requireFields(secrets, ['handle', 'appPassword']);
  const session = await blueskySession(secrets);
  const createdAt = new Date().toISOString();
  const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: text.slice(0, 300),
        createdAt,
      },
    }),
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return { externalId: json.uri || null };
}

// ─── Threads ───────────────────────────────────────────────────────────────

export async function verifyThreads() {
  const secrets = getSecrets('threads');
  requireFields(secrets, ['accessToken', 'threadsUserId']);
  const url = new URL(`https://graph.threads.net/v1.0/${secrets.threadsUserId}`);
  url.searchParams.set('fields', 'id,username,name');
  url.searchParams.set('access_token', secrets.accessToken);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(json.error?.message || `HTTP ${res.status}`);
  }
  return { as: json.username ? `@${json.username}` : json.id };
}

export async function publishThreads(text) {
  const secrets = getSecrets('threads');
  requireFields(secrets, ['accessToken', 'threadsUserId']);
  const createUrl = new URL(`https://graph.threads.net/v1.0/${secrets.threadsUserId}/threads`);
  createUrl.searchParams.set('media_type', 'TEXT');
  createUrl.searchParams.set('text', text);
  createUrl.searchParams.set('access_token', secrets.accessToken);
  const createRes = await fetch(createUrl, { method: 'POST', headers: { 'User-Agent': USER_AGENT } });
  const createJson = await readJson(createRes);
  if (!createRes.ok) {
    throw new Error(createJson.error?.message || `Create failed (${createRes.status})`);
  }
  const creationId = createJson.id;
  await new Promise((r) => setTimeout(r, 1500));
  const pubUrl = new URL(`https://graph.threads.net/v1.0/${secrets.threadsUserId}/threads_publish`);
  pubUrl.searchParams.set('creation_id', creationId);
  pubUrl.searchParams.set('access_token', secrets.accessToken);
  const pubRes = await fetch(pubUrl, { method: 'POST', headers: { 'User-Agent': USER_AGENT } });
  const pubJson = await readJson(pubRes);
  if (!pubRes.ok) {
    throw new Error(pubJson.error?.message || `Publish failed (${pubRes.status})`);
  }
  return { externalId: pubJson.id || creationId };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

export async function verifyPlatform(platform) {
  switch (platform) {
    case 'x':
      return verifyX();
    case 'instagram':
      return verifyInstagram();
    case 'reddit':
      return verifyReddit();
    case 'bluesky':
      return verifyBluesky();
    case 'threads':
      return verifyThreads();
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

export async function publishPlatform(platform, text) {
  switch (platform) {
    case 'x':
      return publishX(text);
    case 'instagram':
      return publishInstagram(text);
    case 'reddit':
      return publishReddit(text);
    case 'bluesky':
      return publishBluesky(text);
    case 'threads':
      return publishThreads(text);
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
