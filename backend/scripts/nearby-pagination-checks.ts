/**
 * Verification for nearby people pagination & honest total count.
 * Asserts:
 * - Hardcoded LIMIT 50 is eliminated from user.service.ts.
 * - getNearbyUsers computes honest COUNT(*) total and returns { users, total, page, limit, has_more }.
 * - routes/users.ts handles page, limit, offset, format and exposes X-Total-Count.
 *
 * Run: npx ts-node scripts/nearby-pagination-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const serviceSrc = fs.readFileSync(
  path.join(__dirname, '../src/services/user.service.ts'),
  'utf8',
);
const routesSrc = fs.readFileSync(
  path.join(__dirname, '../src/routes/users.ts'),
  'utf8',
);

// 1. Hardcoded LIMIT 50 must be completely removed
assert.doesNotMatch(
  serviceSrc,
  /LIMIT\s+50/i,
  'user.service.ts must not have hardcoded LIMIT 50',
);

// 2. getNearbyUsers must calculate COUNT(*) for honest total
assert.match(
  serviceSrc,
  /SELECT\s+COUNT\(\*\)::int\s+AS\s+total/i,
  'user.service.ts must query COUNT(*) total for honest nearby count',
);

// 3. getNearbyUsers must support LIMIT and OFFSET
assert.match(
  serviceSrc,
  /LIMIT\s+(\$\d+|\$\$\{limitIndex\})\s+OFFSET\s+(\$\d+|\$\$\{offsetIndex\})/i,
  'user.service.ts must paginate using parameterized LIMIT and OFFSET',
);

// 4. Result must return honest total, page, limit, has_more
assert.match(
  serviceSrc,
  /return\s*\{\s*users,\s*total,\s*page,\s*limit,\s*has_more/s,
  'user.service.ts must return { users, total, page, limit, has_more }',
);

// 5. routes/users.ts must expose X-Total-Count header and handle pagination params
assert.match(
  routesSrc,
  /res\.setHeader\(['"]X-Total-Count['"],\s*String\(result\.total\)\)/,
  'routes/users.ts must set X-Total-Count header with result.total',
);

assert.match(
  routesSrc,
  /pageNum|limitNum|offsetNum/,
  'routes/users.ts must parse pagination parameters',
);

console.log('nearby-pagination-checks: ok');
