/**
 * MenRush Social Studio — local-only.
 * Keys stay on this device. Never talks to Railway with secrets.
 * Approve is the only action that publishes.
 *
 * Do not dotenv / read `.env.menrush-social` or any repo-root env into this process.
 * Credentials come only from Connections → social-studio/.data/connections.json.
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';
import {
  PLATFORMS,
  PLATFORM_FIELDS,
  loadStore,
  publicConnection,
  updateConnection,
  markVerified,
  storePath,
} from './store.js';
import { verifyPlatform } from './platforms.js';
import { loadWeekDrafts } from './drafts.js';
import { approveWeek, recentPublishLog } from './approve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SOCIAL_STUDIO_PORT || 3847);
const HOST = process.env.SOCIAL_STUDIO_HOST || '127.0.0.1';

const app = express();
app.use(express.json({ limit: '256kb' }));

// Bind localhost only — not a public deploy target
app.use((req, res, next) => {
  res.setHeader('X-MenRush-Social-Studio', 'local-only');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    localOnly: true,
    store: storePath(),
    note: 'Keys never leave this machine via MenRush production APIs.',
  });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    intro:
      'Connections is where the studio gets permission to post. Keys stay on this device. On means that platform is in the week. Verify checks the key before you approve.',
    keySource:
      'Type keys into each card. They save only under social-studio/.data/ on this machine — not into git, not into MenRush production.',
    platforms: PLATFORMS.map((p) => ({
      id: p,
      label: PLATFORM_FIELDS[p].label,
      help: PLATFORM_FIELDS[p].help,
      fields: PLATFORM_FIELDS[p].fields,
    })),
    bearerWarning:
      'X Bearer Token / Application-Only cannot tweet. Use OAuth 1.0a User Context (API Key + Secret + Access Token + Secret).',
  });
});

app.get('/api/connections', (_req, res) => {
  const store = loadStore();
  res.json({
    connections: PLATFORMS.map((p) => publicConnection(store.connections[p])),
  });
});

app.put('/api/connections/:platform', (req, res) => {
  try {
    const platform = req.params.platform;
    if (!PLATFORMS.includes(platform)) {
      res.status(404).json({ error: 'Unknown platform' });
      return;
    }
    const conn = updateConnection(platform, {
      enabled: req.body?.enabled,
      fields: req.body?.fields,
    });
    res.json({ connection: publicConnection(conn) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/connections/:platform/verify', async (req, res) => {
  const platform = req.params.platform;
  if (!PLATFORMS.includes(platform)) {
    res.status(404).json({ error: 'Unknown platform' });
    return;
  }
  // Apply any field updates from the form before verify
  try {
    if (req.body?.fields || typeof req.body?.enabled === 'boolean') {
      updateConnection(platform, {
        enabled: req.body.enabled,
        fields: req.body.fields,
      });
    }
    const result = await verifyPlatform(platform);
    const conn = markVerified(platform, { ok: true, as: result.as });
    res.json({ ok: true, as: result.as, connection: publicConnection(conn) });
  } catch (err) {
    const conn = markVerified(platform, { ok: false, error: err.message });
    res.status(400).json({
      ok: false,
      error: err.message,
      connection: publicConnection(conn),
    });
  }
});

app.get('/api/week', async (_req, res) => {
  try {
    const store = loadStore();
    const enabled = Object.values(store.connections)
      .filter((c) => c.enabled)
      .map((c) => c.platform);
    const all = await loadWeekDrafts();
    const inWeek = all.posts.map((p) => ({
      ...p,
      included: enabled.includes(p.platform),
      ready:
        store.connections[p.platform]?.enabled && store.connections[p.platform]?.verified,
    }));
    const readyPlatforms = Object.values(store.connections)
      .filter((c) => c.enabled && c.verified)
      .map((c) => c.platform);

    res.json({
      ...all,
      posts: inWeek,
      enabledPlatforms: enabled,
      readyPlatforms,
      approveHint:
        'Approve publishes only to On + Verified platforms. Platforms that are Off are excluded. No auto-publish.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/week/approve', async (req, res) => {
  try {
    const result = await approveWeek({
      confirm: req.body?.confirm === true,
      postIds: req.body?.postIds,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/publish-log', (_req, res) => {
  res.json(recentPublishLog());
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = app.listen(PORT, HOST, async () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`MenRush Social Studio (local-only) → ${url}`);
  console.log(`Keys file: ${storePath()}`);
  console.log('Secrets never sent to MenRush production. Approve is what posts.');
  if (process.env.SOCIAL_STUDIO_NO_OPEN !== '1') {
    try {
      await open(url);
    } catch {
      /* browser open is optional */
    }
  }
});

server.on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});
