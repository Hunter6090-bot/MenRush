/** Mandatory regardless of provider availability or legacy beta switches. */
export function isAdultAssuranceRequiredAtSignup(): boolean { return true; }
/** Fixtures can only run in a deliberately selected local test runtime. */
export function isAdultAssuranceTestFixtureAllowed(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.ADULT_ASSURANCE_ALLOW_TEST_FIXTURE === 'true';
}
