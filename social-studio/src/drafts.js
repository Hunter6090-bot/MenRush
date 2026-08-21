/**
 * Load Oct 1 2026 campaign drafts for the current UK week.
 * Prefer local pack (always works offline). Optionally merge from
 * production GET /api/social/posts when ADMIN_TOKEN + SOCIAL_API_URL are set.
 * Never sends connection secrets to MenRush.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDraftMedia } from './media-store.js';

export { OFFICIAL_LOGO } from './media-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK_PATH = path.join(__dirname, 'drafts', 'oct1-2026.json');

/** Platforms that get a visual workspace (preview + prompt + upload). */
export const VISUAL_PLATFORMS = new Set(['instagram', 'x', 'bluesky']);

/** Formats that Approve may publish (Story/Reel stay draft+preview only). */
export const PUBLISHABLE_FORMATS = new Set(['feed', 'post']);

/** Campaign weeks aligned with docs/social-oct1-2026.md (UK calendar). */
export const WEEK_RANGES = [
  { week: 1, start: '2026-08-21', end: '2026-08-27', theme: 'Launch signal' },
  { week: 2, start: '2026-08-28', end: '2026-09-03', theme: 'Nearby / rooms energy' },
  { week: 3, start: '2026-09-04', end: '2026-09-10', theme: 'Early Premium' },
  { week: 4, start: '2026-09-11', end: '2026-09-17', theme: 'Founder / build' },
  { week: 5, start: '2026-09-18', end: '2026-09-24', theme: 'Trust / discretion' },
  { week: 6, start: '2026-09-25', end: '2026-09-28', theme: 'Countdown pressure' },
  { week: 7, start: '2026-09-29', end: '2026-10-01', theme: 'Opening day' },
];

export function ukTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function currentWeekMeta(now = new Date()) {
  const today = ukTodayIso(now);
  for (const w of WEEK_RANGES) {
    if (today >= w.start && today <= w.end) return { ...w, today };
  }
  // Before campaign → week 1; after → last week
  if (today < WEEK_RANGES[0].start) return { ...WEEK_RANGES[0], today, note: 'Before campaign start — showing week 1' };
  return { ...WEEK_RANGES[WEEK_RANGES.length - 1], today, note: 'After launch window — showing final week' };
}

function loadPack() {
  const raw = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
  return raw.posts || [];
}

async function tryFetchRemote() {
  const token = process.env.ADMIN_TOKEN?.trim();
  const base = (process.env.SOCIAL_API_URL || process.env.MENRUSH_API_URL || '').replace(/\/$/, '');
  if (!token || !base) {
    return { ok: false, reason: 'No ADMIN_TOKEN / SOCIAL_API_URL — using local draft pack' };
  }
  try {
    const url = `${base}/api/social/posts?campaign=oct1-2026`;
    const res = await fetch(url, {
      headers: { 'X-Admin-Token': token, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, reason: `Remote social API HTTP ${res.status}` };
    }
    const posts = await res.json();
    if (!Array.isArray(posts)) {
      return { ok: false, reason: 'Remote social API returned unexpected shape' };
    }
    return {
      ok: true,
      posts: posts.map((p) => ({
        id: p.id,
        platform: p.platform,
        body: p.renderedBody || p.rendered_body || '',
        date: (p.scheduledFor || p.scheduled_for || '').slice(0, 10),
        timeUk: '',
        week: Number(p.variables?.week || 0) || null,
        kind: p.variables?.kind || 'full',
        format: p.variables?.format || (p.platform === 'instagram' ? 'feed' : 'post'),
        status: p.status,
        source: 'remote',
      })),
    };
  } catch (err) {
    return { ok: false, reason: `Remote social API unreachable (${err.message})` };
  }
}

function normalizePost(p) {
  const format =
    p.format ||
    (p.platform === 'instagram' ? 'feed' : VISUAL_PLATFORMS.has(p.platform) ? 'post' : 'text');
  const visual = VISUAL_PLATFORMS.has(p.platform);
  const publishable = visual
    ? PUBLISHABLE_FORMATS.has(format)
    : p.platform !== 'instagram';
  return {
    ...p,
    format,
    visual,
    publishable,
    slotLabel: slotLabel(p.platform, format),
  };
}

function slotLabel(platform, format) {
  if (platform === 'instagram') {
    if (format === 'story') return 'IG Story';
    if (format === 'reel') return 'IG Reel';
    return 'IG Feed';
  }
  if (platform === 'x') return 'X';
  if (platform === 'bluesky') return 'Bluesky';
  if (platform === 'reddit') return 'Reddit';
  if (platform === 'threads') return 'Threads';
  return String(platform || '').toUpperCase();
}

/**
 * For each Instagram feed draft in the week, add Story + Reel preview slots
 * (same day / caption seed). Owner edits visuals locally; Approve does not
 * auto-publish Story/Reel.
 */
function expandInstagramSlots(posts) {
  const out = [...posts];
  const existing = new Set(posts.map((p) => p.id));
  for (const p of posts) {
    if (p.platform !== 'instagram') continue;
    const format = p.format || 'feed';
    if (format !== 'feed') continue;

    for (const slot of [
      { format: 'story', suffix: 'story', timeUk: p.timeUk || '19:30', kind: 'story-preview' },
      { format: 'reel', suffix: 'reel', timeUk: p.timeUk || '19:30', kind: 'reel-preview' },
    ]) {
      const id = `${p.date}:instagram:${slot.suffix}`;
      if (existing.has(id)) continue;
      existing.add(id);
      out.push(
        normalizePost({
          id,
          platform: 'instagram',
          date: p.date,
          timeUk: slot.timeUk,
          body: p.body,
          week: p.week,
          kind: slot.kind,
          format: slot.format,
          source: p.source || 'local-pack',
          companionOf: p.id,
        }),
      );
    }
  }
  return out.map((p) => normalizePost(p));
}

function attachMedia(posts) {
  return posts.map((p) => {
    if (!p.visual) return { ...p, media: null };
    return { ...p, media: getDraftMedia(p.id) };
  });
}

export async function loadWeekDrafts({ enabledPlatforms } = {}) {
  const meta = currentWeekMeta();
  const remote = await tryFetchRemote();
  let posts = [];
  let source = 'local-pack';

  if (remote.ok) {
    posts = remote.posts.filter((p) => p.date >= meta.start && p.date <= meta.end);
    source = 'remote';
  } else {
    posts = loadPack().filter((p) => p.date >= meta.start && p.date <= meta.end);
  }

  // Studio Connections platforms only — TikTok drafts stay visible but not approvable here
  const STUDIO_PLATFORMS = new Set(['x', 'instagram', 'reddit', 'bluesky', 'threads']);
  posts = posts.filter((p) => STUDIO_PLATFORMS.has(p.platform));
  posts = expandInstagramSlots(posts.map((p) => normalizePost(p)));

  if (enabledPlatforms && enabledPlatforms.length) {
    const allow = new Set(enabledPlatforms);
    posts = posts.filter((p) => allow.has(p.platform));
  }

  posts.sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    if (d) return d;
    const t = (a.timeUk || '').localeCompare(b.timeUk || '');
    if (t) return t;
    const plat = a.platform.localeCompare(b.platform);
    if (plat) return plat;
    const order = { feed: 0, post: 0, text: 0, story: 1, reel: 2 };
    return (order[a.format] ?? 9) - (order[b.format] ?? 9);
  });

  posts = attachMedia(posts);

  return {
    campaign: 'oct1-2026',
    week: meta,
    source,
    sourceNote: remote.ok ? 'Loaded from production /api/social (read-only).' : remote.reason,
    posts,
  };
}
