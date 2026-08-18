/**
 * Load Oct 1 2026 campaign drafts for the current UK week.
 * Prefer local pack (always works offline). Optionally merge from
 * production GET /api/social/posts when ADMIN_TOKEN + SOCIAL_API_URL are set.
 * Never sends connection secrets to MenRush.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK_PATH = path.join(__dirname, 'drafts', 'oct1-2026.json');

/** Campaign weeks aligned with docs/social-oct1-2026.md (UK calendar). */
export const WEEK_RANGES = [
  { week: 1, start: '2026-08-18', end: '2026-08-24', theme: 'Launch signal' },
  { week: 2, start: '2026-08-25', end: '2026-08-31', theme: 'Nearby / rooms energy' },
  { week: 3, start: '2026-09-01', end: '2026-09-07', theme: 'Early Premium' },
  { week: 4, start: '2026-09-08', end: '2026-09-14', theme: 'Founder / build' },
  { week: 5, start: '2026-09-15', end: '2026-09-21', theme: 'Trust / discretion' },
  { week: 6, start: '2026-09-22', end: '2026-09-28', theme: 'Countdown pressure' },
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
        status: p.status,
        source: 'remote',
      })),
    };
  } catch (err) {
    return { ok: false, reason: `Remote social API unreachable (${err.message})` };
  }
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

  if (enabledPlatforms && enabledPlatforms.length) {
    const allow = new Set(enabledPlatforms);
    posts = posts.filter((p) => allow.has(p.platform));
  }

  posts.sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    if (d) return d;
    return (a.timeUk || '').localeCompare(b.timeUk || '') || a.platform.localeCompare(b.platform);
  });

  return {
    campaign: 'oct1-2026',
    week: meta,
    source,
    sourceNote: remote.ok ? 'Loaded from production /api/social (read-only).' : remote.reason,
    posts,
  };
}
