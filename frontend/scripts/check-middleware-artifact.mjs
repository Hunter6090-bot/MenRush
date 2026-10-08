#!/usr/bin/env node
/**
 * Builds frontend/middleware.ts with `vercel build` (the same builder Vercel
 * uses for a deployment) and then imports and calls the EXACT built
 * middleware under plain Node ESM, from an isolated copy of the function
 * directory, so only files Vercel would ship can be resolved.
 *
 * This catches the outage where Vercel's nodejs runtime ran the per-file
 * transpiled middleware.js and failed with ERR_MODULE_NOT_FOUND on an
 * extensionless relative import, so every /api request got 500
 * MIDDLEWARE_INVOCATION_FAILED. Unit tests could not see it: vitest and tsc
 * resolve extensionless imports.
 *
 * No secrets and no network to MenRush: the build runs in a temp copy with a
 * placeholder project (no `vercel pull`, no env, no token) and an empty
 * global config, so local Vercel logins are never used. The fake secret
 * below exists only in this process. Nothing is logged except pass or fail.
 *
 * Usage (from frontend/, after npm ci): node scripts/check-middleware-artifact.mjs
 * VERCEL_CLI_VERSION overrides the pinned CLI version.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_VERSION = process.env.VERCEL_CLI_VERSION || '62.7.0';
const FAKE_SECRET = 'artifact-check-secret-0123456789';
const VISITOR = '203.0.113.7';
const STRIPPED = ['x-menrush-edge-secret', 'x-menrush-client-ip', 'x-vercel-forwarded-for'];
const SKIP = new Set(['node_modules', 'dist', '.vercel', 'public', 'e2e', 'test-results', 'playwright-report']);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-artifact-'));
try {
  // 1. Temp copy of the frontend project with a placeholder Vercel project.
  const proj = path.join(work, 'frontend');
  fs.cpSync(FRONTEND, proj, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) || path.dirname(src) !== FRONTEND });
  fs.symlinkSync(path.join(FRONTEND, 'node_modules'), path.join(proj, 'node_modules'), 'dir');
  fs.mkdirSync(path.join(proj, '.vercel'));
  fs.writeFileSync(
    path.join(proj, '.vercel/project.json'),
    JSON.stringify({
      projectId: 'prj_artifactcheck',
      orgId: 'team_artifactcheck',
      settings: {
        framework: 'vite',
        // The static site is not under test here; `npm run build` covers it.
        buildCommand: 'mkdir -p dist && echo ok > dist/index.html',
        installCommand: 'true',
        outputDirectory: 'dist',
        rootDirectory: null,
      },
    }),
  );
  // vercel.json's buildCommand wins over project settings: keep its rewrites
  // and the rest, but skip the static site build in the copy too.
  const vercelJsonPath = path.join(proj, 'vercel.json');
  const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  vercelJson.buildCommand = 'mkdir -p dist && echo ok > dist/index.html';
  vercelJson.outputDirectory = 'dist';
  fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelJson));
  const globalConfig = path.join(work, 'vercel-global');
  fs.mkdirSync(globalConfig);

  // 2. vercel build, as a deployment would.
  const env = { ...process.env, VERCEL_TELEMETRY_DISABLED: '1', CI: '1' };
  for (const k of Object.keys(env)) if (/^(VERCEL_(TOKEN|ORG_ID|PROJECT_ID)|EDGE_PROXY_SECRET)$/.test(k)) delete env[k];
  const build = spawnSync('npx', ['--yes', `vercel@${CLI_VERSION}`, 'build', '--yes', '--global-config', globalConfig], {
    cwd: proj,
    env,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    process.stderr.write(`${build.stdout ?? ''}\n${build.stderr ?? ''}\n`);
    throw new Error(`vercel build failed (exit ${build.status})`);
  }

  // 3. The middleware route and function exist and use the Node.js runtime.
  const out = path.join(proj, '.vercel/output');
  const routes = JSON.parse(fs.readFileSync(path.join(out, 'config.json'), 'utf8')).routes ?? [];
  const mwRoute = routes.find((r) => r.middlewarePath);
  assert.ok(mwRoute, 'config.json has a middleware route');
  assert.deepEqual(mwRoute.middlewareRawSrc, ['/api/:path*'], 'middleware matches /api only');
  const funcDir = path.join(out, 'functions', `${mwRoute.middlewarePath}.func`);
  const vc = JSON.parse(fs.readFileSync(path.join(funcDir, '.vc-config.json'), 'utf8'));
  assert.match(String(vc.runtime), /^nodejs\d+/, `middleware runtime is Node.js (got ${vc.runtime})`);

  // 4. Isolated copy: no ancestor node_modules, so Node can resolve only what
  //    Vercel traced into the function. Symlinks are copied as real files.
  const isolated = path.join(fs.mkdtempSync(path.join(work, 'iso-')), 'func');
  fs.cpSync(funcDir, isolated, { recursive: true, dereference: true });
  const handler = path.join(isolated, vc.handler || 'middleware.js');

  // 5. Import the exact built file under Node ESM (this is what failed live).
  delete process.env.EDGE_PROXY_SECRET;
  const mod = await import(pathToFileURL(handler).href);
  const middleware = mod.default;
  assert.equal(typeof middleware, 'function', 'built middleware has a default export function');

  const req = (realIp) =>
    new Request('https://menrush.com/api/health', {
      headers: {
        ...(realIp ? { 'x-real-ip': realIp } : {}),
        'x-menrush-edge-secret': 'client-forged',
        'x-menrush-client-ip': '198.18.0.1',
        'x-vercel-forwarded-for': '198.18.0.2',
      },
    });
  const fwd = (res, name) => res.headers.get(`x-middleware-request-${name}`);
  const listed = (res) => (res.headers.get('x-middleware-override-headers') ?? '').split(',');

  // No secret: request passes through untouched.
  assert.equal(await middleware(req(VISITOR)), undefined, 'no secret: returns undefined');

  process.env.EDGE_PROXY_SECRET = FAKE_SECRET;
  try {
    // Secret and one valid IP: secret + Vercel IP forwarded, client copies replaced.
    const ok = await middleware(req(VISITOR));
    assert.ok(ok instanceof Response, 'secret set: returns a Response');
    assert.equal(ok.headers.get('x-middleware-next'), '1');
    assert.equal(fwd(ok, 'x-menrush-edge-secret'), FAKE_SECRET);
    assert.equal(fwd(ok, 'x-menrush-client-ip'), VISITOR);
    assert.equal(fwd(ok, 'x-vercel-forwarded-for'), null);
    for (const n of STRIPPED) assert.ok(listed(ok).includes(n), `override list names ${n}`);

    // Secret but no IP: no secret, no client-ip, client copies listed for deletion.
    const noIp = await middleware(req(null));
    assert.ok(noIp instanceof Response, 'no IP: returns a Response');
    for (const n of STRIPPED) {
      assert.equal(fwd(noIp, n), null, `no IP: ${n} not forwarded`);
      assert.ok(listed(noIp).includes(n), `no IP: override list names ${n}`);
    }
  } finally {
    delete process.env.EDGE_PROXY_SECRET;
  }

  console.log(`middleware artifact check: ok (vercel@${CLI_VERSION} build, ${vc.runtime}, isolated Node ${process.version} ESM import, 3 invocations)`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
