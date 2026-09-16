#!/usr/bin/env node
/**
 * Blocks deploys if UI source uses wrong brand marks (radar CSS, black-plate logos)
 * or omits the official transparent cutout.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(frontendRoot, 'src');
const brandMarkPath = join(srcRoot, 'components', 'BrandMark.tsx');
const brandTsPath = join(srcRoot, 'lib', 'brand.ts');

const canonicalMaster = '/brand/menrush-logo.png';
/** Brand + Zoul lock: UI chrome uses the transparent cutout only. */
const canonicalMedallion = '/brand/medallion-transparent.png';
const canonicalMasterFile = join(frontendRoot, 'public', 'brand', 'menrush-logo.png');
const canonicalMedallionFile = join(frontendRoot, 'public', 'brand', 'medallion-transparent.png');
/** Handoff medallion-480.png is the WRONG radar seal — never use as canonical. */
const forbiddenMedallion480Md5 = '4c544cadc5dd0302232bee047305713e';

const forbiddenPatterns = [
  // Black-plate RGB files — never in UI chrome (BrandMark, headers, heroes).
  /['"`]\/brand\/menrush-logo-\d+\.png['"`]/,
  /['"`]\/brand\/menrush-logo\.png['"`]/,
  /['"`]\/menrush-logo\.png['"`]/,
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

if (!existsSync(canonicalMasterFile)) {
  console.error(`[brand-guard] Missing master logo: public${canonicalMaster}`);
  failed = true;
}

if (!existsSync(canonicalMedallionFile)) {
  console.error(`[brand-guard] Missing UI cutout: public${canonicalMedallion}`);
  failed = true;
} else {
  const magic = readFileSync(canonicalMedallionFile).subarray(0, 8);
  const isPng = magic.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng) {
    console.error('[brand-guard] medallion-transparent.png must be a real PNG with alpha.');
    failed = true;
  }
}

const legacyMedallion480 = join(frontendRoot, 'public', 'brand', 'medallion-480.png');
if (existsSync(legacyMedallion480)) {
  const md5 = createHash('md5').update(readFileSync(legacyMedallion480)).digest('hex');
  if (md5 === forbiddenMedallion480Md5) {
    console.error(
      '[brand-guard] public/brand/medallion-480.png is the handoff radar seal. Run npm run brand:sync-logo.',
    );
    failed = true;
  }
}

const brandTs = readFileSync(brandTsPath, 'utf8');
if (!brandTs.includes(`BRAND_MEDALLION = '${canonicalMedallion}'`)) {
  console.error(`[brand-guard] brand.ts must export ${canonicalMedallion} as BRAND_MEDALLION.`);
  failed = true;
}
if (
  brandTs.includes("BRAND_MEDALLION = '/brand/menrush-logo-512.png'") ||
  brandTs.includes("BRAND_MEDALLION_SMALL = '/brand/menrush-logo-192.png'")
) {
  console.error('[brand-guard] brand.ts must not point BrandMark at black-plate menrush-logo-* files.');
  failed = true;
}

const brandMark = readFileSync(brandMarkPath, 'utf8');
if (!brandMark.includes('BRAND_MEDALLION') || !brandMark.includes('<img')) {
  console.error('[brand-guard] BrandMark.tsx must render the canonical medallion via <img>.');
  failed = true;
}

for (const file of walk(srcRoot)) {
  const rel = file.slice(srcRoot.length + 1);
  if (rel === 'lib/brand.ts') continue;
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
console.log('[brand-guard] Official transparent cutout enforced for BrandMark UI chrome.');
