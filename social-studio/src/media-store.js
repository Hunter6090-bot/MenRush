/**
 * Per-draft visual media + caption overrides.
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
const VISUALS_DIR = path.join(__dirname, '..', 'public', 'visuals');

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

/** Official MenRush medallion — unmodified. */
export const OFFICIAL_LOGO = 'https://menrush.com/menrush-logo.png';

/** Built-in photo plate options (not Midjourney film-set scenes). */
export const PHOTO_PLATES = [
  {
    id: 'logo',
    label: 'Official logo',
    url: OFFICIAL_LOGO,
    day1Default: false,
  },
  {
    id: 'nearby-verified-now',
    label: 'Nearby. Verified. Now.',
    url: '/visuals/nearby-verified-now.svg',
    day1Default: true,
  },
  {
    id: 'opens-october',
    label: 'Opens 1 October',
    url: '/visuals/opens-october.svg',
    day1Default: false,
  },
  {
    id: 'signal-dark',
    label: 'Less noise. More signal.',
    url: '/visuals/signal-dark.svg',
    day1Default: false,
  },
];

export const PLATFORM_TAGS = {
  x: ['#GayMen', '#GayUK'],
  instagram: ['#GayMen', '#LGBTQ', '#GayLondon', '#GayUK', '#GayDating'],
  bluesky: ['#GayMen', '#LGBTQ', '#GayUK'],
  threads: ['#GayMen', '#LGBTQ', '#GayUK'],
  tiktok: ['#GayMen', '#LGBTQ', '#GayLondon', '#GayUK', '#GayDating'],
  reddit: [],
};

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
  return { version: 2, byDraftId: {} };
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
    version: 2,
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
    caption: null,
    headline: null,
    subhead: null,
    plateId: null,
    imageRelPath: null,
    publicImageUrl: '',
    source: null,
    updatedAt: null,
  };
}

function plateById(id) {
  return PHOTO_PLATES.find((p) => p.id === id) || null;
}

function defaultPlateForDraft(draftId, date) {
  // Day 1 (21 Aug) uses Nearby. Verified. Now. brand frame when no custom image.
  if (date === '2026-08-21' || (draftId && String(draftId).startsWith('2026-08-21'))) {
    return plateById('nearby-verified-now');
  }
  return plateById('logo');
}

export function getDraftMedia(draftId, { date } = {}) {
  const store = loadMediaStore();
  const entry = store.byDraftId[draftId] || emptyEntry();
  return publicDraftMedia(draftId, entry, date);
}

function publicDraftMedia(draftId, entry, date) {
  const hasUpload = Boolean(entry.imageRelPath);
  let imageUrl = null;
  if (hasUpload) {
    imageUrl = `/api/drafts/${encodeURIComponent(draftId)}/image?t=${encodeURIComponent(entry.updatedAt || '')}`;
  }

  const plate =
    (!hasUpload && entry.plateId && plateById(entry.plateId)) ||
    (!hasUpload ? defaultPlateForDraft(draftId, date) : null);

  const previewUrl = imageUrl || plate?.url || OFFICIAL_LOGO;
  const isLogo = previewUrl === OFFICIAL_LOGO;

  return {
    draftId,
    prompt: entry.prompt || '',
    caption: entry.caption,
    headline: entry.headline,
    subhead: entry.subhead,
    hasImage: hasUpload,
    imageRelPath: entry.imageRelPath || null,
    imageUrl,
    plateId: hasUpload ? 'upload' : plate?.id || 'logo',
    previewUrl,
    defaultLogo: isLogo && !hasUpload,
    publicImageUrl: entry.publicImageUrl || '',
    source: entry.source || (hasUpload ? 'upload' : plate?.id || 'default-logo'),
    updatedAt: entry.updatedAt || null,
  };
}

export function listPhotoPlates() {
  return PHOTO_PLATES.map((p) => ({
    id: p.id,
    label: p.label,
    url: p.url,
    day1Default: Boolean(p.day1Default),
  }));
}

export function updateDraftMedia(draftId, fields = {}) {
  if (!draftId || typeof draftId !== 'string') throw new Error('draftId required');
  const store = loadMediaStore();
  const entry = { ...emptyEntry(), ...store.byDraftId[draftId] };

  if (typeof fields.prompt === 'string') entry.prompt = fields.prompt.slice(0, 2000);
  if (typeof fields.publicImageUrl === 'string') {
    entry.publicImageUrl = fields.publicImageUrl.trim().slice(0, 2000);
  }
  if (typeof fields.caption === 'string') entry.caption = fields.caption.slice(0, 8000);
  if (fields.caption === null) entry.caption = null;
  if (typeof fields.headline === 'string') entry.headline = fields.headline.slice(0, 200);
  if (typeof fields.subhead === 'string') entry.subhead = fields.subhead.slice(0, 300);

  if (typeof fields.plateId === 'string') {
    const plate = plateById(fields.plateId);
    if (!plate) throw new Error(`Unknown plate: ${fields.plateId}`);
    // Selecting a plate clears uploaded custom image
    if (entry.imageRelPath) {
      const abs = path.join(DATA_DIR, entry.imageRelPath);
      assertDataPath(abs);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
    entry.imageRelPath = null;
    entry.plateId = fields.plateId === 'logo' ? null : fields.plateId;
    entry.source = fields.plateId;
  }

  entry.updatedAt = new Date().toISOString();
  store.byDraftId[draftId] = entry;
  saveMediaStore(store);
  return publicDraftMedia(draftId, entry, fields.date);
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
  entry.plateId = null;
  entry.source = source || 'upload';
  entry.updatedAt = new Date().toISOString();
  store.byDraftId[draftId] = entry;
  saveMediaStore(store);
  return publicDraftMedia(draftId, entry);
}

export function clearDraftImage(draftId, { date } = {}) {
  const store = loadMediaStore();
  const entry = { ...emptyEntry(), ...store.byDraftId[draftId] };
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
  return publicDraftMedia(draftId, entry, date);
}

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

/** Effective caption for display/publish (override or pack body). */
export function effectiveCaption(draftId, packBody) {
  const store = loadMediaStore();
  const entry = store.byDraftId[draftId];
  if (entry && typeof entry.caption === 'string') return entry.caption;
  return packBody || '';
}

export function mediaDataDir() {
  return DATA_DIR;
}

export function visualsDir() {
  return VISUALS_DIR;
}
