/**
 * ADULT_ASSURANCE_SIGNUP_REQUIRED: only the exact value 'true' turns the signup
 * Veriff check on. Unset, empty, 'false' and junk values all mean OFF, including
 * when Veriff keys are configured. Offline, no provider calls, no database.
 */
import assert from 'assert';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-signup-flag';
// Veriff "configured" with dummy values, so the old fallback (on when configured) would show.
process.env.VERIFF_API_KEY = 'dummy-key-for-offline-test';
process.env.VERIFF_SHARED_SECRET = 'dummy-secret-for-offline-test';

async function main() {
  const { isAdultAssuranceRequiredAtSignup, adultAssuranceService } = await import(
    '../src/services/adult-assurance.service'
  );
  const { isVeriffConfigured } = await import('../src/services/veriff.service');
  assert.equal(isVeriffConfigured(), true, 'precondition: Veriff looks configured');

  const cases: Array<[string, string | undefined, boolean]> = [
    ['unset', undefined, false],
    ['empty', '', false],
    ['false', 'false', false],
    ['true', 'true', true],
    ['junk TRUE', 'TRUE', false],
    ['junk True', 'True', false],
    ['junk 1', '1', false],
    ['junk yes', 'yes', false],
    ['junk on', 'on', false],
    ['junk padded', ' true ', false],
    ['junk word', 'required', false],
  ];

  for (const [label, value, expected] of cases) {
    if (value === undefined) delete process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED;
    else process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = value;
    assert.equal(isAdultAssuranceRequiredAtSignup(), expected, `${label} => ${expected}`);
    assert.equal(adultAssuranceService.isRequiredAtSignup(), expected, `service ${label} => ${expected}`);
  }

  // Unset stays OFF with Veriff keys removed too.
  delete process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED;
  process.env.VERIFF_API_KEY = '';
  process.env.VERIFF_SHARED_SECRET = '';
  assert.equal(isAdultAssuranceRequiredAtSignup(), false, 'unset without Veriff => false');

  console.log(`adult-assurance-signup-flag-checks: OK (${cases.length + 1} cases)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
