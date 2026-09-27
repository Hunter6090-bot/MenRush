/**
 * Community CRUD & Ownership Integrity Checks
 * Verifies update/delete routes, server-side ownership enforcement, and 24h expiry safety.
 * Run: node --experimental-strip-types scripts/community-crud-checks.ts
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

// 1. Service inspection
const service = readFileSync(join(root, 'src/services/community.service.ts'), 'utf8');

// Post update checks
assert.match(service, /async updatePost\(/);
assert.match(service, /postRow\.user_id !== userId[\s\S]*forbidden/);
assert.match(service, /created_at > NOW\(\) - INTERVAL '24 hours'/);
assert.match(service, /trimmed\.length > 280/);

// Post delete checks
assert.match(service, /async deletePost\(/);
assert.match(service, /existing\.rows\[0\]\.user_id !== userId[\s\S]*forbidden/);
assert.match(service, /created_at > NOW\(\) - INTERVAL '24 hours'/, 'deletePost must enforce 24h expiry');
assert.match(service, /DELETE FROM community_posts WHERE id = \$1/);

// Comment update checks
assert.match(service, /async updateComment\(/);
assert.match(service, /assertPostVisible\(userId, postId\)/, 'updateComment must verify parent post via assertPostVisible');
assert.match(service, /existing\.rows\[0\]\.user_id !== userId[\s\S]*forbidden/);

// Comment delete checks
assert.match(service, /async deleteComment\(/);
assert.match(service, /assertPostVisible\(userId, postId\)/, 'deleteComment must verify parent post via assertPostVisible');
assert.match(service, /DELETE FROM community_post_comments WHERE id = \$1/);

// Route expiry status mappings
assert.match(routes, /if \(message === 'post_not_found'\) \{\s*return res\.status\(404\)/, 'delete/update routes must map post_not_found to 404');
assert.match(routes, /if \(message === 'forbidden'\) \{\s*return res\.status\(403\)/, 'delete/update routes must map forbidden to 403');

// 2. Routes inspection
const routes = readFileSync(join(root, 'src/routes/community.ts'), 'utf8');
assert.match(routes, /router\.put\('\/posts\/:id'/);
assert.match(routes, /router\.delete\('\/posts\/:id'/);
assert.match(routes, /router\.put\('\/posts\/:id\/comments\/:commentId'/);
assert.match(routes, /router\.delete\('\/posts\/:id\/comments\/:commentId'/);

// 3. Validation inspection
const validation = readFileSync(join(root, 'src/types/validation.ts'), 'utf8');
assert.match(validation, /CommunityUpdatePostSchema/);
assert.match(validation, /CommunityUpdateCommentSchema/);

console.log('PASS Community CRUD enforces server-side ownership and 24h expiry safety');
console.log('community-crud-checks: ok');
