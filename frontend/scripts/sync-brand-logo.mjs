#!/usr/bin/env node
/**
 * Regenerate all MenRush logo derivatives from the single master file.
 * Master: public/brand/menrush-logo.png (1024×1020 bronze medallion — do not replace).
 *
 * Usage: node scripts/sync-brand-logo.mjs
 */
import { copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(frontendRoot, 'public', 'brand');
const master = join(brandDir, 'menrush-logo.png');

if (!existsSync(master)) {
  console.error('[sync-brand-logo] Missing master: public/brand/menrush-logo.png');
  process.exit(1);
}

function resize(size, out) {
  execSync(`sips -z ${size} ${size} "${master}" --out "${out}"`, { stdio: 'ignore' });
}

const targets = [
  [480, join(brandDir, 'medallion-480.png')],
  [380, join(brandDir, 'medallion-380.png')],
  [512, join(brandDir, 'icon-512.png')],
  [192, join(brandDir, 'icon-192.png')],
  [180, join(brandDir, 'icon-180.png')],
  [167, join(brandDir, 'icon-167.png')],
  [152, join(brandDir, 'icon-152.png')],
  [120, join(brandDir, 'icon-120.png')],
  [1024, join(brandDir, 'icon-1024.png')],
  [87, join(brandDir, 'icon-87.png')],
  [80, join(brandDir, 'icon-80.png')],
  [76, join(brandDir, 'icon-76.png')],
  [60, join(brandDir, 'icon-60.png')],
  [48, join(brandDir, 'icon-48.png')],
  [32, join(brandDir, 'icon-32.png')],
  [16, join(brandDir, 'icon-16.png')],
  [512, join(brandDir, 'menrush-logo-512.png')],
  [192, join(brandDir, 'menrush-logo-192.png')],
  [48, join(brandDir, 'menrush-logo-48.png')],
];

for (const [size, out] of targets) {
  resize(size, out);
}

copyFileSync(join(brandDir, 'icon-512.png'), join(brandDir, 'app-icon-512.png'));
copyFileSync(join(brandDir, 'icon-192.png'), join(brandDir, 'app-icon-192.png'));
copyFileSync(master, join(frontendRoot, 'public', 'menrush-logo.png'));

const emailTargets = [
  join(frontendRoot, '..', 'email-assets', 'menrush-logo.png'),
  join(frontendRoot, '..', 'email-assets', 'welcome-email-bundle', 'menrush-logo.png'),
  join(frontendRoot, '..', 'backend', 'email-assets', 'menrush-logo.png'),
];
for (const dest of emailTargets) {
  if (existsSync(dirname(dest))) {
    copyFileSync(master, dest);
  }
}

console.log('[sync-brand-logo] Regenerated derivatives from public/brand/menrush-logo.png');
