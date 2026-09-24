/** Offline contract checks; transaction/HTTP coverage is in mandatory-age-checks.ts. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { isAdultFromLivenessDecision, extractVeriffEstimatedAge } from '../src/lib/veriff-age';
import { isAdultAssuranceRequiredAtSignup, isAdultAssuranceTestFixtureAllowed } from '../src/config/adult-assurance';
import { verifyAgeEstimationWebhook, isAgeEstimationConfigured } from '../src/services/veriff-age-integration';
for (const environment of ['production','development','test','']) {
  process.env.NODE_ENV=environment;
  process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED='false';
  assert.equal(isAdultAssuranceRequiredAtSignup(),true);
  process.env.ADULT_ASSURANCE_ALLOW_TEST_FIXTURE='true';
  process.env.ADULT_ASSURANCE_STAGING_FIXTURE='true';
  assert.equal(isAdultAssuranceTestFixtureAllowed(), environment==='test');
}
for (const age of [undefined,null,'18','18garbage',NaN,Infinity,-1,121]) {
  assert.equal(extractVeriffEstimatedAge({verification:{additionalVerifiedData:{estimatedAge:age}}}),null);
  assert.equal(isAdultFromLivenessDecision({verification:{additionalVerifiedData:{estimatedAge:age}}}).ok,false);
}
for(const age of [0,17,17.99]) assert.equal(isAdultFromLivenessDecision({verification:{additionalVerifiedData:{estimatedAge:age}}}).ok,false);
for(const age of [18,18.01,30]) assert.equal(isAdultFromLivenessDecision({verification:{additionalVerifiedData:{estimatedAge:age}}}).ok,true);
assert.equal(isAdultFromLivenessDecision({verification:{person:{dateOfBirth:'1990-01-01'}}}).ok,false);
assert.equal(isAdultFromLivenessDecision({verification:{person:{dateOfBirth:'2015-01-01'},additionalVerifiedData:{estimatedAge:30}}}).ok,false);
process.env.VERIFF_API_KEY='id-test';
process.env.VERIFF_AGE_ESTIMATION_API_KEY='age-test';
process.env.VERIFF_AGE_ESTIMATION_SHARED_SECRET='age-test-secret';
process.env.VERIFF_AGE_ESTIMATION_API_BASE='https://example.invalid/v1';
assert.equal(isAgeEstimationConfigured(),true);
const raw=Buffer.from('{"verification":{}}');
const signature=crypto.createHmac('sha256','age-test-secret').update(raw).digest('hex');
assert.equal(verifyAgeEstimationWebhook(raw,signature,'age-test'),true);
assert.equal(verifyAgeEstimationWebhook(Buffer.from('{}'),signature,'age-test'),false);
assert.equal(verifyAgeEstimationWebhook(raw,signature,'id-test'),false);
assert.equal(verifyAgeEstimationWebhook(raw,'invalid','age-test'),false);
process.env.VERIFF_AGE_ESTIMATION_API_KEY='id-test'; assert.equal(isAgeEstimationConfigured(),false);
console.log('Mandatory age policy, numeric evidence and integration HMAC offline checks passed.');
