/**
 * Capture mobile before/after structural proof screenshots:
 * - JS chunk names + decoded sizes for /conversations (no mapbox)
 * - same for /discover (mapbox present after)
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const API = (process.env.MEASURE_API_URL || `${BASE}/api`).replace(/\/$/, '');
const OUT_DIR = '/opt/cursor/artifacts';

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@example.com', password: 'MenRushTest2026!' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  return res.json();
}

async function shot(deviceName, device, auth, path, fileBase) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...device });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, auth);
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => /\.js(\?|$)/.test(r.name))
      .map((r) => ({
        name: r.name.split('/').pop(),
        kb: Math.round((r.decodedBodySize || 0) / 1024),
      }))
      .sort((a, b) => b.kb - a.kb),
  );
  const overlay = {
    device: deviceName,
    path,
    includesMapbox: scripts.some((s) => /mapbox/i.test(s.name || '')),
    jsDecodedKB: scripts.reduce((s, r) => s + r.kb, 0),
    top: scripts.slice(0, 8),
  };
  await page.evaluate((info) => {
    const el = document.createElement('pre');
    el.setAttribute('data-testid', 'perf-overlay');
    el.style.cssText =
      'position:fixed;inset:auto 8px 8px 8px;z-index:99999;max-height:42%;overflow:auto;background:rgba(13,10,6,0.92);color:#F0E0C0;font:11px/1.35 ui-monospace,monospace;padding:10px;border:1px solid #C4832A;border-radius:10px;';
    el.textContent = JSON.stringify(info, null, 2);
    document.body.appendChild(el);
  }, overlay);
  mkdirSync(OUT_DIR, { recursive: true });
  const file = `${OUT_DIR}/${fileBase}.png`;
  await page.screenshot({ path: file, fullPage: false });
  writeFileSync(`${OUT_DIR}/${fileBase}.json`, JSON.stringify(overlay, null, 2));
  await browser.close();
  return overlay;
}

async function main() {
  const auth = await login();
  const results = [];
  for (const [id, device] of [
    ['iphone', devices['iPhone 13']],
    ['android', devices['Pixel 5']],
  ]) {
    results.push(await shot(id, device, auth, '/conversations', `after_${id}_chat_no_mapbox`));
    results.push(await shot(id, device, auth, '/discover', `after_${id}_discover_with_mapbox`));
    results.push(await shot(id, device, auth, '/profile', `after_${id}_profile_no_mapbox`));
  }
  writeFileSync(`${OUT_DIR}/mobile_perf_screenshots_summary.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
