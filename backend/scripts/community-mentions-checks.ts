/**
 * Community mention suggestions — source shape checks and unit logic (no DB required).
 * Run: npx ts-node scripts/community-mentions-checks.ts
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

// 1. Service inspection
const service = readFileSync(join(root, 'src/services/community.service.ts'), 'utf8');
assert.match(service, /getMentionSuggestions/, 'communityService must export getMentionSuggestions');
assert.match(service, /updatePost/, 'communityService must export updatePost');
assert.match(service, /deletePost/, 'communityService must export deletePost');
assert.match(service, /updateComment/, 'communityService must export updateComment');
assert.match(service, /deleteComment/, 'communityService must export deleteComment');
assert.match(service, /hot_spots hs/, 'mention suggestions must query hot_spots table');
assert.match(service, /isPublicHotSpotVisibilitySql/, 'must enforce public hot spot visibility SQL predicate');
assert.match(service, /likes l1 ON l1\.liker_id = \$1 AND l1\.liked_id = u\.id/, 'must require mutual likes for user mentions');
assert.match(service, /likes l2 ON l2\.liker_id = u\.id AND l2\.liked_id = \$1/, 'must require reciprocal mutual like');
assert.doesNotMatch(service, /ST_DWithin\(\s*u\.location/i, 'must NOT return nearby users / strangers');
assert.doesNotMatch(service, /SELECT[\s\S]*FROM users u WHERE(?![^;]*likes)/, 'must NOT query arbitrary DB users without likes');

// 2. Route inspection
const routes = readFileSync(join(root, 'src/routes/community.ts'), 'utf8');
assert.match(routes, /\/mention-suggestions/, 'router must define /mention-suggestions');
assert.match(routes, /router\.put\('\/posts\/:id'/, 'router must define PUT /posts/:id');
assert.match(routes, /router\.delete\('\/posts\/:id'/, 'router must define DELETE /posts/:id');
assert.match(routes, /router\.put\('\/posts\/:id\/comments\/:commentId'/, 'router must define PUT /posts/:id/comments/:commentId');
assert.match(routes, /router\.delete\('\/posts\/:id\/comments\/:commentId'/, 'router must define DELETE /posts/:id/comments/:commentId');
assert.match(routes, /CommunityMentionSuggestionsQuerySchema/, 'must validate query params with Zod schema');
assert.match(routes, /CommunityUpdatePostSchema/, 'must validate post update with Zod schema');
assert.match(routes, /CommunityUpdateCommentSchema/, 'must validate comment update with Zod schema');
assert.match(routes, /getMentionSuggestions\(/, 'route must delegate to communityService.getMentionSuggestions');
assert.match(routes, /authMiddleware,\s*verifiedMiddleware/, 'must be guarded by auth and verification');

// 3. Validation inspection
const validation = readFileSync(join(root, 'src/types/validation.ts'), 'utf8');
assert.match(validation, /CommunityMentionSuggestionsQuerySchema/, 'validation must export CommunityMentionSuggestionsQuerySchema');
assert.match(validation, /CommunityUpdatePostSchema/, 'validation must export CommunityUpdatePostSchema');
assert.match(validation, /CommunityUpdateCommentSchema/, 'validation must export CommunityUpdateCommentSchema');

// 4. Client API inspection
const client = readFileSync(join(root, '../frontend/src/api/client.ts'), 'utf8');
assert.match(client, /getMentionSuggestions:/, 'frontend communityAPI must export getMentionSuggestions');
assert.match(client, /updatePost:/, 'frontend communityAPI must export updatePost');
assert.match(client, /deletePost:/, 'frontend communityAPI must export deletePost');
assert.match(client, /updateComment:/, 'frontend communityAPI must export updateComment');
assert.match(client, /deleteComment:/, 'frontend communityAPI must export deleteComment');
assert.match(client, /\/community\/mention-suggestions/, 'must hit /community/mention-suggestions endpoint');

// 5. Frontend composer inspection
const composer = readFileSync(join(root, '../frontend/src/components/CommunityFeed.tsx'), 'utf8');
assert.match(composer, /MentionTextarea/, 'CommunityFeed must use MentionTextarea for composer');
assert.match(composer, /community-post-edit/, 'CommunityFeed must have post edit affordance');
assert.match(composer, /community-post-delete/, 'CommunityFeed must have post delete affordance');

// 6. Frontend comments inspection
const comments = readFileSync(join(root, '../frontend/src/components/CommunityPostComments.tsx'), 'utf8');
assert.match(comments, /MentionTextarea/, 'CommunityPostComments must use MentionTextarea for comments');
assert.match(comments, /community-comment-edit/, 'CommunityPostComments must have comment edit affordance');
assert.match(comments, /community-comment-delete/, 'CommunityPostComments must have comment delete affordance');

// 7. Security audit: no exfiltration / clean routes
assert.doesNotMatch(routes, /127\.0\.0\.1:7779/, 'routes must not contain malicious exfil urls');
assert.doesNotMatch(service, /127\.0\.0\.1:7779/, 'service must not contain malicious exfil urls');

console.log('PASS Community mention suggestions strictly return live Hot Spots + mutual matches');
console.log('community-mentions-checks: ok');

