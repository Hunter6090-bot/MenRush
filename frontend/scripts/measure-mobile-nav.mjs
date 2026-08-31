/**
 * Mobile web page-to-page probe (iPhone + Android-sized Chromium, CPU throttle).
 *
 * PLAYWRIGHT_BASE_URL=https://menrush.com node scripts/measure-mobile-nav.mjs --out out.json
 * MEASURE_LABEL=after PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 ...
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'https://menrush.com').replace(/\/$/, '');
const API = (process.env.MEASURE_API_URL || 'https://backend-production-d587.up.railway.app/api').replace(
  /\/$/,
  '',
);
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const LABEL = process.env.MEASURE_LABEL || 'run';

const DEVICE_PRESETS = [
  { id: 'iphone', device: devices['iPhone 13'] },
  { id: 'android', device: devices['Pixel 5'] },
];

async function loginToken() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@example.com', password: 'MenRushTest2026!' }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return res.json();
}

async function waitContent(page, path) {
  const patterns = {
    '/discover': [/Nearby|MAP|Community|Pulse|Discover/i],
    '/matches': [/Match|Liked|You liked|No matches/i],
    '/profile': [/Profile|Settings|Edit|Premium|Sign out|Photos/i],
    '/conversations': [/Message|Conversation|Inbox|Chat|No conversation/i],
    '/rooms': [/Room|Rooms|Group|Chat/i],
  };
  const res = patterns[path] || [/MenRush/i];
  const t0 = Date.now();
  for (const re of res) {
    try {
      await page.getByText(re).first().waitFor({ state: 'visible', timeout: 20_000 });
      return Date.now() - t0;
    } catch {
      /* try next */
    }
  }
  return Date.now() - t0;
}

async function measureDevice(browser, auth, preset) {
  const context = await browser.newContext({ ...preset.device });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, auth);

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  const responses = [];
  page.on('response', (response) => {
    responses.push({
      url: response.url(),
      status: response.status(),
      type: response.request().resourceType(),
      fromSW: response.fromServiceWorker(),
    });
  });

  const coldT0 = Date.now();
  await page.goto(`${BASE}/discover`, { waitUntil: 'load', timeout: 120_000 });
  const coldContentMs = await waitContent(page, '/discover');
  const coldTotalMs = Date.now() - coldT0;
  await page.waitForTimeout(1500);

  const facts = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const scripts = resources
      .filter((r) => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name))
      .map((r) => ({
        name: r.name.split('/').pop(),
        transferSize: r.transferSize,
        encodedBodySize: r.encodedBodySize,
        decodedBodySize: r.decodedBodySize,
        duration: Math.round(r.duration),
      }))
      .sort((a, b) => (b.decodedBodySize || 0) - (a.decodedBodySize || 0));
    return {
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      scripts: scripts.slice(0, 12),
      scriptDecodedTotal: scripts.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
      sw: {
        controller: Boolean(navigator.serviceWorker?.controller),
        scriptURL: navigator.serviceWorker?.controller?.scriptURL || null,
      },
    };
  });

  const routes = ['/matches', '/conversations', '/profile', '/rooms', '/discover'];
  const soft = [];
  for (const path of routes) {
    const batch = [];
    const onResp = (response) => {
      batch.push({
        url: response.url(),
        type: response.request().resourceType(),
        fromSW: response.fromServiceWorker(),
      });
    };
    page.on('response', onResp);
    const t0 = Date.now();
    const clicked = await page
      .locator(`a[href="${path}"]`)
      .first()
      .click({ timeout: 2500 })
      .then(() => true)
      .catch(() => false);
    if (!clicked) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }
    const contentMs = await waitContent(page, path);
    await page.waitForTimeout(500);
    page.off('response', onResp);

    const api = batch.filter((r) => r.url.includes('/api/') || r.type === 'fetch' || r.type === 'xhr');
    const js = batch.filter((r) => r.type === 'script' || /\.js(\?|$)/.test(r.url));
    soft.push({
      path,
      clicked,
      contentReadyMs: contentMs,
      wallMs: Date.now() - t0,
      apiCount: api.length,
      apiPaths: [...new Set(api.map((a) => a.url.replace(/^.*\/api\//, '/api/').split('?')[0]))].slice(
        0,
        12,
      ),
      swProxied: batch.filter((r) => r.fromSW).length,
      jsChunks: [...new Set(js.map((r) => r.url.split('/').pop()?.split('?')[0]))],
      fetchedMapboxJs: js.some((r) => /mapbox/i.test(r.url)),
    });
  }

  const fullReload = {};
  for (const path of ['/matches', '/profile', '/conversations']) {
    const t0 = Date.now();
    await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 120_000 });
    const scripts = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((r) => /\.js(\?|$)/.test(r.name))
        .map((r) => ({
          name: r.name.split('/').pop(),
          decodedBodySize: r.decodedBodySize,
        })),
    );
    fullReload[path] = {
      wallMs: Date.now() - t0,
      contentReadyMs: await waitContent(page, path),
      jsDecodedTotal: scripts.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
      jsNames: scripts.map((s) => s.name),
      includesMapbox: scripts.some((s) => /mapbox/i.test(s.name || '')),
    };
  }

  await context.close();
  return {
    device: preset.id,
    coldDiscover: { wallMs: coldTotalMs, contentReadyMs: coldContentMs },
    facts,
    softNav: soft,
    fullReload,
    swProxiedTotal: responses.filter((r) => r.fromSW).length,
    responseTotal: responses.length,
  };
}

async function main() {
  const auth = await loginToken();
  const browser = await chromium.launch({ headless: true });
  const devicesOut = [];
  for (const preset of DEVICE_PRESETS) {
    devicesOut.push(await measureDevice(browser, auth, preset));
  }
  await browser.close();

  const report = {
    label: LABEL,
    base: BASE,
    at: new Date().toISOString(),
    note: 'CPU x6 on Chromium mobile profiles (iPhone 13 + Pixel 5). Not a claim of live Al/Pete devices.',
    devices: devicesOut,
  };
  const json = JSON.stringify(report, null, 2);
  console.log(json);
  if (OUT) writeFileSync(OUT, json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
