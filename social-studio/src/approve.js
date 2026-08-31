/**
 * Approve / publish — only On + Verified platforms. No timers.
 * Results logged locally in .data/publish-log.json (never secrets).
 *
 * Instagram Graph needs a public https image_url. Owner-saved local photos are
 * hosted automatically on Approve. The brand logo is never used as the post image.
 * Rows without an owner photo are skipped (not substituted).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore } from './store.js';
import { loadWeekDrafts } from './drafts.js';
import { publishPlatform } from './platforms.js';
import {
  getDraftMedia,
  readDraftImageBuffer,
  effectiveCaption,
  ensurePublicOwnerImageUrl,
} from './media-store.js';
import { isPublicHttpsImageUrl, isRasterOwnerPhoto } from './public-image.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, '..', '.data', 'publish-log.json');

function readLog() {
  try {
    if (fs.existsSync(LOG_PATH)) return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    /* ignore */
  }
  return { runs: [] };
}

function writeLog(log) {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), { mode: 0o600 });
}

function hasOwnerRasterPhoto(draftId) {
  const local = readDraftImageBuffer(draftId);
  return Boolean(local && isRasterOwnerPhoto(local.mimeType));
}

/**
 * Build publish options. For Instagram, auto-hosts the owner photo to public https.
 * Returns { opts, skipReason } — skipReason set means do not send.
 */
async function publishOptsFor(post) {
  const media = getDraftMedia(post.id);
  const opts = { format: post.format || 'post' };

  if (post.platform === 'instagram') {
    // Prefer already-public owner URL (never the logo — isPublicHttpsImageUrl rejects it).
    if (isPublicHttpsImageUrl(media.publicImageUrl)) {
      opts.imageUrl = media.publicImageUrl.trim();
      return { opts, skipReason: null };
    }

    if (!hasOwnerRasterPhoto(post.id)) {
      return {
        opts,
        skipReason:
          'Skipped — no owner photo on this draft. Upload a real picture (not the logo) before Approve.',
      };
    }

    const hosted = await ensurePublicOwnerImageUrl(post.id);
    if (!hosted.ok || !hosted.url) {
      return {
        opts,
        skipReason: hosted.error || 'Skipped — could not publish owner photo to a public https URL.',
      };
    }
    opts.imageUrl = hosted.url;
    opts.imageHosted = { host: hosted.host, reused: hosted.reused };
    return { opts, skipReason: null };
  }

  if (post.platform === 'x' || post.platform === 'bluesky') {
    const local = readDraftImageBuffer(post.id);
    if (local && isRasterOwnerPhoto(local.mimeType)) {
      opts.image = local;
    }
    // Text-only X/Bluesky is allowed; they never fall back to the logo.
    return { opts, skipReason: null };
  }

  return { opts, skipReason: null };
}

export async function approveWeek({ confirm, postIds } = {}) {
  if (confirm !== true) {
    throw new Error('Confirm required. Set confirm: true — Approve is the only action that publishes.');
  }

  const store = loadStore();
  const ready = Object.values(store.connections).filter((c) => c.enabled && c.verified);
  if (!ready.length) {
    throw new Error('No platforms are On and Verified. Fill a card, Verify, leave On — then Approve.');
  }

  const enabledPlatforms = ready.map((c) => c.platform);
  const week = await loadWeekDrafts({ enabledPlatforms });
  let posts = week.posts.filter((p) => p.publishable !== false);
  if (Array.isArray(postIds) && postIds.length) {
    const want = new Set(postIds);
    posts = posts.filter((p) => want.has(p.id));
  }

  // Prefer today's posts when present; otherwise whole week for On platforms
  const today = week.week.today;
  const todayPosts = posts.filter((p) => p.date === today);
  const queue = todayPosts.length ? todayPosts : posts;

  const results = [];
  for (const post of queue) {
    const entry = {
      id: post.id,
      platform: post.platform,
      format: post.format || null,
      date: post.date,
      timeUk: post.timeUk,
      ok: false,
      skipped: false,
      error: null,
      externalId: null,
      mediaAttached: false,
      imageUrl: null,
      warning: null,
    };
    try {
      const { opts, skipReason } = await publishOptsFor(post);
      if (skipReason) {
        entry.skipped = true;
        entry.ok = false;
        entry.error = skipReason;
        results.push(entry);
        continue;
      }
      const caption = effectiveCaption(post.id, post.body);
      const out = await publishPlatform(post.platform, caption, opts);
      entry.ok = true;
      entry.externalId = out.externalId || null;
      entry.mediaAttached = Boolean(out.mediaAttached);
      entry.imageUrl = opts.imageUrl || null;
      entry.warning = out.warning || null;
    } catch (err) {
      entry.ok = false;
      entry.error = err.message || String(err);
    }
    results.push(entry);
  }

  const run = {
    at: new Date().toISOString(),
    week: week.week.week,
    theme: week.week.theme,
    scope: todayPosts.length ? 'today' : 'week',
    platforms: enabledPlatforms,
    results,
  };
  const log = readLog();
  log.runs.unshift(run);
  log.runs = log.runs.slice(0, 50);
  writeLog(log);

  const skipped = results.filter((r) => r.skipped).length;
  return {
    week: week.week,
    scope: run.scope,
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok && !r.skipped).length,
      skipped,
    },
  };
}

export function recentPublishLog() {
  return readLog();
}
