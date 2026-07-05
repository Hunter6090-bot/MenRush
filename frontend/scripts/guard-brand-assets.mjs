#!/usr/bin/env node
/**
 * Ensures auth/landing pages use the original CoinFlip medallion logo.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(frontendRoot, 'src');

const checks = [
  {
    file: 'components/CoinFlip.tsx',
    pattern: /BRAND_MEDALLION/,
    message: 'CoinFlip must reference BRAND_MEDALLION',
  },
  {
    file: 'components/PublicAuthShell.tsx',
    pattern: /<CoinFlip\b/,
    message: 'PublicAuthShell must render CoinFlip',
  },
  {
    file: 'lib/brand.ts',
    pattern: /menrush-logo-512/,
    message: 'brand.ts must export menrush-logo-512 paths',
  },
  {
    file: 'pages/BetaAccess.tsx',
    pattern: /coinFlip=/,
    message: 'BetaAccess must pass coinFlip to PublicAuthShell',
  },
  {
    file: 'pages/Login.tsx',
    pattern: /coinFlip=/,
    message: 'Login must pass coinFlip to PublicAuthShell',
  },
  {
    file: 'pages/Register.tsx',
    pattern: /coinFlip=/,
    message: 'Register must pass coinFlip to PublicAuthShell',
  },
  {
    file: 'pages/ComingSoon.tsx',
    pattern: /<CoinFlip\b/,
    message: 'ComingSoon must render CoinFlip',
  },
];

let failed = false;

for (const { file, pattern, message } of checks) {
  const content = readFileSync(join(srcRoot, file), 'utf8');
  if (!pattern.test(content)) {
    console.error(`[brand-guard] ${message} (src/${file})`);
    failed = true;
  }
}

const publicAuthShell = readFileSync(join(srcRoot, 'components/PublicAuthShell.tsx'), 'utf8');
if (/BrandMark/.test(publicAuthShell)) {
  console.error('[brand-guard] PublicAuthShell must use CoinFlip, not BrandMark.');
  failed = true;
}

if (failed) process.exit(1);
console.log('[brand-guard] CoinFlip medallion logo present on auth/landing pages.');
