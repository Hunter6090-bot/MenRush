/**
 * Per-draft visual media (prompt + local image path).
 * Lives only under social-studio/.data/ — gitignored, never secrets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '.data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const STORE_PATH = path.join(DATA_DIR, 'draft-media.json');

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

/** Official MenRush medallion — unmodified. Default preview when no upload. */
export const OFFICIAL_LOGO = 'https://menrush.com/menrush-logo.png';

function assertDataPath(target) {
  const resolved = path.resolve(target);
  const root = path.resolve(DATA_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Refusing media path outside social-studio/.data/');
  }
}

function ensureDirs() {
  assertDataPath(DATA_DIR);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  assertDataPath(MEDIA_DIR);
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true, mode: 0o700 });
}

function defaultStore() {
  return { version: 1, byDraftId: {} };
}

export function loadMediaStore() {
  ensureDirs();
  assertDataPath(STORE_PATH);
  if (!fs.existsSync(STORE_PATH)) {
    const fresh = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(fresh, null, 2), { mode: 0o600 });
    return fresh;
  }
  const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  return {
    version: 1,
    byDraftId: raw.byDraftId && typeof raw.byDraftId === 'object' ? raw.byDraftId : {},
  };
}

function saveMediaStore(store) {
  ensureDirs();
  assertDataPath(STORE_PATH);
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function emptyEntry() {
  return {
    prompt: '',
    imageRelPath: null,
    publicImageUrl: '',
    source: null,
    updatedAt: null,
  };
}

export function getDraftMedia(draftId) {
  const store = loadMediaStore();
  const entry = store.byDraftId[draftId] || emptyEntry();
  return publicDraftMedia(draftId, entry);
}

function publicDraftMedia(draftId, entry) {
  const hasCustomImage = Boolean(entry.imageRelPath);
  let imageUrl = null;
  if (hasCustomImage) {
    imageUrl = `/api/drafts/${encodeURIComponent(draftId)}/image?t=${encodeURIComponent(entry.updatedAt || '')}`;
  }
  return {
    draftId,
    prompt: entry.prompt || '',
    /** True only when owner uploaded or generated a custom asset. */
    hasImage: hasCustomImage,
    imageRelPath: entry.imageRelPath || null,
    imageUrl,
    /** Always set — official logo until a custom image exists. Never redraw the logo. */
    previewUrl: imageUrl || OFFICIAL_LOGO,
    defaultLogo: !hasCustomImage,
    publicImageUrl: entry.publicImageUrl || '',
    source: entry.source || (hasCustomImage ? null : 'default-logo'),
    updatedAt: entry.updatedAt || null,
  };
}

export function updateDraftMedia(draftId, { prompt, publicImageUrl } = {}) {
  if (!draftId || typeof draftId !== 'string') throw new Error('draftId required');
  const store = loadMediaStore();
  const entry = { ...emptyEntry(), ...store.byDraftId[draftId] };
  if (typeof prompt === 'string') entry.prompt = prompt.slice(0, 2000);
  if (typeof publicImageUrl === 'string') {
    entry.publicImageUrl = publicImageUrl.trim().slice(0, 2000);
  }
  entry.updatedAt = new Date().toISOString();
  store.byDraftId[draftId] = entry;
  saveMediaStore(store);
  return publicDraftMedia(draftId, entry);
}

function safeExt(filename, mimeType) {
  const fromName = path.extname(filename || '').toLowerCase();
  if (ALLOWED_EXT.has(fromName)) return fromName;
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  return map[mimeType] || '.png';
}

export function saveDraftImage(draftId, { buffer, mimeType, filename, source }) {
  if (!draftId) throw new Error('draftId required');
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('Image data required');
  }
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Image too large (max 8MB)');
  }
  ensureDirs();
  const ext = safeExt(filename, mimeType);
  const safeId = draftId.replace(/[^a-zA-Z0-9:_-]/g, '_').replace(/:/g, '-');
  const rel = path.join('media', `${safeId}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  const abs = path.join(DATA_DIR, rel);
  assertDataPath(abs);

  // Remove previous local file if any
  const store = loadMediaStore();
  const prev = store.byDraftId[draftId];
  if (prev?.imageRelPath) {
    const oldAbs = path.join(DATA_DIR, prev.imageRelPath);
    assertDataPath(oldAbs);
    if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
  }

  fs.writeFileSync(abs, buffer, { mode: 0o600 });
  const entry = { ...emptyEntry(), ...store.byDraftId[draftId] };
  entry.imageRelPath = rel.split(path.sep).join('/');
  entry.source = source || 'upload';
  entry.updatedAt = new Date().toISOString();
  store.byDraftId[draftId] = entry;
  saveMediaStore(store);
  return publicDraftMedia(draftId, entry);
}

export function clearDraftImage(draftId) {
  const store = loadMediaStore();
  const entry = store.byDraftId[draftId];
  if (!entry) return publicDraftMedia(draftId, emptyEntry());
  if (entry.imageRelPath) {
    const abs = path.join(DATA_DIR, entry.imageRelPath);
    assertDataPath(abs);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
  entry.imageRelPath = null;
  entry.source = null;
  entry.updatedAt = new Date().toISOString();
  store.byDraftId[draftId] = entry;
  saveMediaStore(store);
  return publicDraftMedia(draftId, entry);
}

/** Absolute path to local image bytes, or null. */
export function resolveDraftImagePath(draftId) {
  const store = loadMediaStore();
  const entry = store.byDraftId[draftId];
  if (!entry?.imageRelPath) return null;
  const abs = path.join(DATA_DIR, entry.imageRelPath);
  assertDataPath(abs);
  if (!fs.existsSync(abs)) return null;
  return abs;
}

export function readDraftImageBuffer(draftId) {
  const abs = resolveDraftImagePath(draftId);
  if (!abs) return null;
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.svg'
              ? 'image/svg+xml'
              : 'application/octet-stream';
  return { buffer: buf, mimeType: mime, path: abs };
}

export function mediaDataDir() {
  return DATA_DIR;
}
