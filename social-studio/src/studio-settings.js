/**
 * Optional studio settings (not platform Connections).
 * Image-gen API key stays local in .data — never committed.
 * Used only to enable a remote Generate control; local poster works without it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '.data');
const SETTINGS_PATH = path.join(DATA_DIR, 'studio-settings.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

function defaultSettings() {
  return {
    version: 1,
    imageGen: {
      apiKey: '',
      provider: '',
    },
  };
}

export function loadStudioSettings() {
  ensureDir();
  if (!fs.existsSync(SETTINGS_PATH)) {
    const fresh = defaultSettings();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(fresh, null, 2), { mode: 0o600 });
    return fresh;
  }
  const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  const base = defaultSettings();
  return {
    ...base,
    ...raw,
    imageGen: { ...base.imageGen, ...(raw.imageGen || {}) },
  };
}

export function saveStudioSettings(next) {
  ensureDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
}

export function publicStudioSettings() {
  const s = loadStudioSettings();
  const key = s.imageGen?.apiKey || '';
  return {
    imageGen: {
      configured: Boolean(key.trim()),
      provider: s.imageGen?.provider || '',
      masked: key
        ? `${'•'.repeat(Math.min(12, Math.max(0, key.length - 4)))}${key.slice(-4)}`
        : '',
      note: 'Optional. Local poster Generate works without a key. Remote AI Generate stays off until a key is saved here.',
    },
  };
}

export function updateImageGenSettings({ apiKey, provider } = {}) {
  const s = loadStudioSettings();
  if (typeof provider === 'string') s.imageGen.provider = provider.trim().slice(0, 80);
  if (typeof apiKey === 'string') {
    const next = apiKey.trim();
    // Empty means leave existing (masked UI)
    if (next !== '' || !s.imageGen.apiKey) {
      if (next !== '') s.imageGen.apiKey = next.slice(0, 500);
    }
  }
  saveStudioSettings(s);
  return publicStudioSettings();
}

export function hasImageGenKey() {
  return Boolean(loadStudioSettings().imageGen?.apiKey?.trim());
}
