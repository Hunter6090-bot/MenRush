#!/usr/bin/env node
/**
 * Blocks deploys if UI source uses wrong brand marks (radar CSS, menrush-logo-* variants)
 * or omits the canonical two-profile medallion.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(frontendRoot, 'src');
const brandMarkPath = join(srcRoot, 'components', 'BrandMark.tsx');
const brandTsPath = join(srcRoot, 'lib', 'brand.ts');

const canonicalMedallion = '/brand/medallion-480.png';
const canonicalMedallionFile = join(frontendRoot, 'public', 'brand', 'medallion-480.png');

const forbiddenPatterns = [
  /['"`]\/brand\/menrush-logo-\d+\.png['"`]/,
  /animate-\[mr-radar_/,
  /mr-radar_2\.4s/,
  /from ['"].*CoinFlip['"]/,
  /<CoinFlip\b/,
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (/\.(tsx?|jsx?)$/.test(entry)) files.push(path);
  }
  return files;
}

let failed = false;

if (!existsSync(canonicalMedallionFile)) {
  console.error(`[brand-guard] Missing canonical medallion asset: public${canonicalMedallion}`);
  failed = true;
}

const brandTs = readFileSync(brandTsPath, 'utf8');
if (!brandTs.includes(canonicalMedallion)) {
  console.error(`[brand-guard] brand.ts must export ${canonicalMedallion} as BRAND_MEDALLION.`);
  failed = true;
}

const brandMark = readFileSync(brandMarkPath, 'utf8');
if (!brandMark.includes('BRAND_MEDALLION') || !brandMark.includes('<img')) {
  console.error('[brand-guard] BrandMark.tsx must render the canonical medallion via <img>.');
  failed = true;
}

for (const file of walk(srcRoot)) {
  const rel = file.slice(srcRoot.length + 1);
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      console.error(`[brand-guard] Forbidden brand reference in src/${rel}: ${pattern}`);
      failed = true;
    }
  }
}

const manifest = readFileSync(join(frontendRoot, 'public', 'manifest.json'), 'utf8');
if (/menrush-logo/.test(manifest)) {
  console.error('[brand-guard] manifest.json still references menrush-logo assets.');
  failed = true;
}

if (failed) process.exit(1);
console.log('[brand-guard] Canonical two-profile medallion enforced in UI source.');
