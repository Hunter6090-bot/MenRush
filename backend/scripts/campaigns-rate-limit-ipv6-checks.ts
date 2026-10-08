/**
 * Campaign rate-limit IPv6 key — offline checks.
 *
 * Ensures custom keyGenerators in campaigns.ts use ipKeyGenerator so
 * express-rate-limit does not log ERR_ERL_KEY_GEN_IPV6, and that IPv6
 * addresses are bucketed by subnet. No network. No DB.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { ipKeyGenerator } from 'express-rate-limit';

const CAMPAIGNS_ROUTE = path.join(__dirname, '../src/routes/campaigns.ts');

async function main() {
  const src = fs.readFileSync(CAMPAIGNS_ROUTE, 'utf8');

  assert.match(
    src,
    /import rateLimit,\s*\{\s*ipKeyGenerator\s*\}\s*from\s*'express-rate-limit'/,
    'campaigns.ts must import ipKeyGenerator from express-rate-limit',
  );
  assert.doesNotMatch(
    src,
    /keyGenerator:\s*\([^)]*\)\s*=>\s*\{[^}]*return\s+(?:ip|raw)\s*;/s,
    'keyGenerator must not return a raw IP string',
  );
  const kgBlocks = src.match(/keyGenerator:\s*\(req\)\s*=>\s*\{[\s\S]*?\},/g) || [];
  assert.equal(kgBlocks.length, 2, 'expected signup + validate keyGenerators');
  for (const block of kgBlocks) {
    assert.match(block, /return ipKeyGenerator\(ip\)/, 'each keyGenerator must call ipKeyGenerator');
  }

  // Library behaviour the route relies on.
  assert.equal(ipKeyGenerator('1.2.3.4'), '1.2.3.4');
  const v6 = ipKeyGenerator('2001:db8:85a3::8a2e:370:7334');
  assert.match(v6, /\/\d+$/, 'IPv6 keys must include a subnet prefix');
  assert.notEqual(v6, '2001:db8:85a3::8a2e:370:7334');
  assert.equal(
    ipKeyGenerator('2001:db8:85a3::8a2e:370:7334'),
    ipKeyGenerator('2001:db8:85a3::1'),
    'same /56 subnet should share a bucket',
  );

  console.log('campaigns-rate-limit-ipv6-checks: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
