/**
 * Stats field visibility: migration + public query CASE WHEN guards.
 * Hide must not delete stored values (owner columns remain).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..');
const mig = fs.readFileSync(
  path.join(root, 'database/migrations/046_stats_field_visibility.sql'),
  'utf8',
);
const service = fs.readFileSync(
  path.join(root, 'backend/src/services/user.service.ts'),
  'utf8',
);
const validation = fs.readFileSync(
  path.join(root, 'backend/src/types/validation.ts'),
  'utf8',
);

assert.match(mig, /show_height BOOLEAN NOT NULL DEFAULT TRUE/);
assert.match(mig, /show_weight BOOLEAN NOT NULL DEFAULT TRUE/);
assert.match(mig, /show_relationship BOOLEAN NOT NULL DEFAULT TRUE/);
assert.match(mig, /show_hosting BOOLEAN NOT NULL DEFAULT TRUE/);

assert.match(validation, /show_height: z\.boolean\(\)\.optional\(\)/);
assert.match(validation, /show_weight: z\.boolean\(\)\.optional\(\)/);
assert.match(validation, /show_relationship: z\.boolean\(\)\.optional\(\)/);
assert.match(validation, /show_hosting: z\.boolean\(\)\.optional\(\)/);

assert.match(
  service,
  /CASE WHEN COALESCE\(u\.show_height, TRUE\) THEN u\.height_cm ELSE NULL END AS height_cm/,
);
assert.match(
  service,
  /CASE WHEN COALESCE\(u\.show_weight, TRUE\) THEN u\.weight_kg ELSE NULL END AS weight_kg/,
);
assert.match(
  service,
  /CASE WHEN COALESCE\(u\.show_relationship, TRUE\) THEN u\.relationship_status ELSE NULL END AS relationship_status/,
);
assert.match(
  service,
  /CASE WHEN COALESCE\(u\.show_hosting, TRUE\) THEN u\.hosting_status ELSE NULL END AS hosting_status/,
);

// Owner profile returns raw values + show flags (not nulled).
assert.match(service, /u\.show_height, u\.show_weight, u\.show_relationship, u\.show_hosting/);
assert.match(service, /if \(data\.show_height !== undefined\)/);

console.log('stats-field-visibility-checks: ok');
