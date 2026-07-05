#!/usr/bin/env node
/**
 * Blocks deploys if canonical coin logos were replaced by flat app icons.
 */
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'brand');

function sizeOf(file) {
  return statSync(join(root, file)).size;
}

const coin512 = sizeOf('menrush-logo-512.png');
const coin192 = sizeOf('menrush-logo-192.png');
const flat512 = sizeOf('app-icon-512.png');
const flat192 = sizeOf('app-icon-192.png');

let failed = false;

if (coin512 < 400_000) {
  console.error(`[brand-guard] menrush-logo-512.png is ${coin512}B — must be the bronze coin (>= 400KB).`);
  console.error('[brand-guard] Restore: git checkout e27a726 -- frontend/public/brand/menrush-logo-512.png');
  failed = true;
}
if (coin192 < 60_000) {
  console.error(`[brand-guard] menrush-logo-192.png is ${coin192}B — must be the bronze coin (>= 60KB).`);
  console.error('[brand-guard] Restore: git checkout e27a726 -- frontend/public/brand/menrush-logo-192.png');
  failed = true;
}
if (Math.abs(coin512 - flat512) < 10_000) {
  console.error('[brand-guard] menrush-logo-512.png matches app-icon-512.png — coin was overwritten with flat icon.');
  failed = true;
}
if (flat512 > 400_000) {
  console.error(`[brand-guard] app-icon-512.png is ${flat512}B — flat app icon should stay separate from coin.`);
  failed = true;
}

if (failed) process.exit(1);
console.log('[brand-guard] Coin logo and flat app icon are correctly separated.');
