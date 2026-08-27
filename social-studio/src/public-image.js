/**
 * Host an owner-saved local photo at a public https URL Facebook Graph can fetch.
 * Prefer https://menrush.com/images/ig/… (and existing /images/ library matches).
 * Never returns the MenRush logo. No API tokens required from the owner.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USER_AGENT = 'MenRushSocialStudio/1.0 (local; +https://menrush.com)';

/** Sacred brand mark — must never be the social post image. */
export const FORBIDDEN_LOGO_URLS = [
  'https://menrush.com/menrush-logo.png',
  'http://menrush.com/menrush-logo.png',
  'https://www.menrush.com/menrush-logo.png',
];

const RASTER_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

/** freeimage.host documented public demo key (no owner token). Override with SOCIAL_STUDIO_FREEIMAGE_KEY. */
const FREEIMAGE_KEY =
  process.env.SOCIAL_STUDIO_FREEIMAGE_KEY?.trim() || '6d207e02198a847aa98d0a2a901485a5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'images');
const IG_DIR = path.join(REPO_IMAGES_DIR, 'ig');
const MENRUSH_PUBLIC_BASE = 'https://menrush.com/images';

export function isForbiddenLogoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase().split('?')[0].replace(/\/$/, '');
  return FORBIDDEN_LOGO_URLS.some((bad) => u === bad.toLowerCase() || u.endsWith('/menrush-logo.png'));
}

export function isPublicHttpsImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!/^https:\/\//i.test(t)) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])[:/]/i.test(t)) return false;
  if (/^https?:\/\/192\.168\./i.test(t) || /^https?:\/\/10\./i.test(t)) return false;
  if (isForbiddenLogoUrl(t)) return false;
  return true;
}

export function isRasterOwnerPhoto(mimeType) {
  return RASTER_MIME.has(String(mimeType || '').toLowerCase());
}

export function contentHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _raw: text.slice(0, 300) };
  }
}

async function assertFetchableImage(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`Hosted image not fetchable (${res.status})`);
  }
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!ctype.startsWith('image/')) {
    throw new Error(`Hosted URL is not an image (${ctype || 'no content-type'})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Hosted image empty');
  if (isForbiddenLogoUrl(url)) {
    throw new Error('Refusing MenRush logo as post image');
  }
  return url;
}

async function hostViaFreeimage(buffer, mimeType, filename) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  form.append('source', blob, filename || 'owner-photo.png');
  form.append('type', 'file');
  form.append('action', 'upload');
  form.append('key', FREEIMAGE_KEY);

  const res = await fetch('https://freeimage.host/api/1/upload', {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const json = await readJson(res);
  const url = json?.image?.url || json?.image?.display_url || json?.url;
  if (!res.ok || !url) {
    throw new Error(json?.error?.message || json?.status_txt || `freeimage upload failed (${res.status})`);
  }
  return assertFetchableImage(String(url).trim());
}

async function hostViaUguu(buffer, mimeType, filename) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  form.append('files[]', blob, filename || 'owner-photo.png');

  const res = await fetch('https://uguu.se/upload.php', {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const json = await readJson(res);
  const url = json?.files?.[0]?.url;
  if (!res.ok || !json?.success || !url) {
    throw new Error(json?.error || `uguu upload failed (${res.status})`);
  }
  return assertFetchableImage(String(url).trim());
}

/**
 * Upload owner photo bytes → public https URL Graph can GET.
 * Tries freeimage.host then uguu.se. Never returns the brand logo.
 */
export async function hostOwnerPhotoPublic({ buffer, mimeType, filename } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('Owner photo bytes required');
  }
  if (!isRasterOwnerPhoto(mimeType)) {
    throw new Error(
      `Owner photo must be a real picture (PNG/JPEG/WebP/GIF), not ${mimeType || 'unknown'}. SVG/logo plates are not posted.`,
    );
  }

  const errors = [];
  for (const [name, fn] of [
    ['freeimage.host', hostViaFreeimage],
    ['uguu.se', hostViaUguu],
  ]) {
    try {
      const url = await fn(buffer, mimeType, filename);
      if (!isPublicHttpsImageUrl(url)) {
        throw new Error(`${name} returned a non-public or forbidden URL`);
      }
      return { url, host: name };
    } catch (err) {
      errors.push(`${name}: ${err.message || err}`);
    }
  }
  throw new Error(`Could not host owner photo at a public https URL. ${errors.join(' | ')}`);
}

export async function probePublicImageUrl(url) {
  if (!isPublicHttpsImageUrl(url)) return false;
  try {
    await assertFetchableImage(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy owner photo into frontend/public/images/ig so it can ship on menrush.com.
 * Returns the intended public URL (may not be live until Vercel deploys).
 */
export function syncOwnerPhotoToMenrushIg(draftId, { buffer, mimeType, path: localPath } = {}) {
  if (!buffer?.length) return null;
  if (!fs.existsSync(REPO_IMAGES_DIR)) return null;

  if (!fs.existsSync(IG_DIR)) fs.mkdirSync(IG_DIR, { recursive: true });

  const ext =
    mimeType === 'image/jpeg' || mimeType === 'image/jpg'
      ? '.jpg'
      : mimeType === 'image/webp'
        ? '.webp'
        : mimeType === 'image/gif'
          ? '.gif'
          : path.extname(localPath || '') || '.png';

  const safe = String(draftId || 'draft')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const short = contentHash(buffer).slice(0, 10);
  const filename = `${safe}-${short}${ext}`;
  const abs = path.join(IG_DIR, filename);
  fs.writeFileSync(abs, buffer);
  return {
    filename,
    absPath: abs,
    url: `${MENRUSH_PUBLIC_BASE}/ig/${filename}`,
  };
}

/** If this exact photo already lives under public/images/, return its live menrush.com URL. */
export async function findLiveMenrushImageUrl(buffer) {
  if (!buffer?.length || !fs.existsSync(REPO_IMAGES_DIR)) return null;
  const want = contentHash(buffer);

  const stack = [REPO_IMAGES_DIR];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!/\.(png|jpe?g|webp|gif)$/i.test(ent.name)) continue;
      if (/menrush-logo/i.test(ent.name)) continue;
      let bytes;
      try {
        bytes = fs.readFileSync(abs);
      } catch {
        continue;
      }
      if (contentHash(bytes) !== want) continue;
      const rel = path.relative(REPO_IMAGES_DIR, abs).split(path.sep).join('/');
      const url = `${MENRUSH_PUBLIC_BASE}/${rel}`;
      if (await probePublicImageUrl(url)) return url;
    }
  }
  return null;
}
