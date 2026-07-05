#!/usr/bin/env node
/**
 * Blocks deploys if UI source reintroduces bronze coin / medallion PNG marks.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(frontendRoot, 'src');

const forbiddenPatterns = [
  /['"`]\/brand\/menrush-logo-\d+\.png['"`]/,
  /['"`]\/brand\/medallion[^'"`]*['"`]/,
  /from ['"].*CoinFlip['"]/,
  /BRAND_MEDALLION/,
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

for (const file of walk(srcRoot)) {
  const rel = file.slice(srcRoot.length + 1);
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      console.error(`[brand-guard] Forbidden coin/medallion reference in src/${rel}: ${pattern}`);
      failed = true;
    }
  }
}

const manifest = readFileSync(join(frontendRoot, 'public', 'manifest.json'), 'utf8');
if (/menrush-logo/.test(manifest)) {
  console.error('[brand-guard] manifest.json still references menrush-logo coin assets.');
  failed = true;
}

if (failed) process.exit(1);
console.log('[brand-guard] No coin/medallion marks referenced in UI source.');
