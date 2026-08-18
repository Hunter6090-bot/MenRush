/**
 * Approve / publish — only On + Verified platforms. No timers.
 * Results logged locally in .data/publish-log.json (never secrets).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore } from './store.js';
import { loadWeekDrafts } from './drafts.js';
import { publishPlatform } from './platforms.js';

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
  let posts = week.posts;
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
      date: post.date,
      timeUk: post.timeUk,
      ok: false,
      error: null,
      externalId: null,
    };
    try {
      const out = await publishPlatform(post.platform, post.body);
      entry.ok = true;
      entry.externalId = out.externalId || null;
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

  return {
    week: week.week,
    scope: run.scope,
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    },
  };
}

export function recentPublishLog() {
  return readLog();
}
