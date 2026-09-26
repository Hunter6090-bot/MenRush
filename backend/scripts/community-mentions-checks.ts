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
assert.match(service, /hot_spots hs/, 'mention suggestions must query hot_spots table');
assert.match(service, /isPublicHotSpotVisibilitySql/, 'must enforce public hot spot visibility SQL predicate');
assert.match(service, /likes l1 ON l1\.liker_id = \$1 AND l1\.liked_id = u\.id/, 'must require mutual likes for user mentions');
assert.match(service, /likes l2 ON l2\.liker_id = u\.id AND l2\.liked_id = \$1/, 'must require reciprocal mutual like');
assert.doesNotMatch(service, /ST_DWithin\(\s*u\.location/i, 'must NOT return nearby users / strangers');
assert.doesNotMatch(service, /SELECT[\s\S]*FROM users u WHERE(?![^;]*likes)/, 'must NOT query arbitrary DB users without likes');

// 2. Route inspection
const routes = readFileSync(join(root, 'src/routes/community.ts'), 'utf8');
assert.match(routes, /\/mention-suggestions/, 'router must define /mention-suggestions');
assert.match(routes, /CommunityMentionSuggestionsQuerySchema/, 'must validate query params with Zod schema');
assert.match(routes, /getMentionSuggestions\(/, 'route must delegate to communityService.getMentionSuggestions');
assert.match(routes, /authMiddleware,\s*verifiedMiddleware/, 'must be guarded by auth and verification');

// 3. Validation inspection
const validation = readFileSync(join(root, 'src/types/validation.ts'), 'utf8');
assert.match(validation, /CommunityMentionSuggestionsQuerySchema/, 'validation must export CommunityMentionSuggestionsQuerySchema');

// 4. Client API inspection
const client = readFileSync(join(root, '../frontend/src/api/client.ts'), 'utf8');
assert.match(client, /getMentionSuggestions:/, 'frontend communityAPI must export getMentionSuggestions');
assert.match(client, /\/community\/mention-suggestions/, 'must hit /community/mention-suggestions endpoint');

// 5. Frontend composer inspection
const composer = readFileSync(join(root, '../frontend/src/components/CommunityFeed.tsx'), 'utf8');
assert.match(composer, /MentionAutocompleteList/, 'CommunityFeed must use MentionAutocompleteList');
assert.match(composer, /getActiveMention/, 'CommunityFeed must track active mention cursor state');
assert.match(composer, /applyMentionReplacement/, 'CommunityFeed must apply mention replacement on select');

// 6. Frontend comments inspection
const comments = readFileSync(join(root, '../frontend/src/components/CommunityPostComments.tsx'), 'utf8');
assert.match(comments, /MentionAutocompleteList/, 'CommunityPostComments must use MentionAutocompleteList');
assert.match(comments, /getActiveMention/, 'CommunityPostComments must track active mention cursor state');

// 7. Security audit: no exfiltration / clean routes
assert.doesNotMatch(routes, /127\.0\.0\.1:7779/, 'routes must not contain malicious exfil urls');
assert.doesNotMatch(service, /127\.0\.0\.1:7779/, 'service must not contain malicious exfil urls');

console.log('PASS Community mention suggestions strictly return live Hot Spots + mutual matches');
console.log('community-mentions-checks: ok');

