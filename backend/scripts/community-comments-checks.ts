/**
 * Community post comments — source shape checks (no DB required).
 * Run: npx ts-node scripts/community-comments-checks.ts
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');

const migration = readFileSync(
  join(root, 'database/migrations/043_community_post_comments.sql'),
  'utf8',
);
assert.match(migration, /CREATE TABLE IF NOT EXISTS community_post_comments/);
assert.match(migration, /VARCHAR\(280\)/);
assert.match(migration, /REFERENCES community_posts\(id\) ON DELETE CASCADE/);
assert.doesNotMatch(migration, /photo_url|video|media/i);

const service = readFileSync(join(root, 'src/services/community.service.ts'), 'utf8');
assert.match(service, /listComments/);
assert.match(service, /createComment/);
assert.match(service, /comment_count/);
assert.match(service, /trimmed\.length > 280/);

const routes = readFileSync(join(root, 'src/routes/community.ts'), 'utf8');
assert.match(routes, /\/posts\/:id\/comments/);
assert.match(routes, /CommunityCreateCommentSchema/);
assert.doesNotMatch(routes, /isPremium|requirePremium/);

const validation = readFileSync(join(root, 'src/types/validation.ts'), 'utf8');
assert.match(validation, /CommunityCreateCommentSchema/);
assert.match(validation, /Comment must be 280 characters or fewer/);

console.log('PASS community comments are text-only ≤280, free, nested under posts');
console.log('community-comments-checks: ok');
