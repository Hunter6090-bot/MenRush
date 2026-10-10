/**
 * Strict-truth guard for the Terms (section 1.4 and 3.1) and Help copy.
 *
 * The adult assurance signup flag (ADULT_ASSURANCE_SIGNUP_REQUIRED) is OFF, so signup
 * is date of birth plus an 18 or over tick, and the Veriff ID check is optional and
 * only gives the Verified badge. Public copy must not claim a required selfie or age
 * check, or that no account is created if one fails. If the flag is ever switched on,
 * this copy and this test must change together, with Legal sign off.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
const flat = (src: string) => src.replace(/\s+/g, ' ');

const terms = flat(read('./Terms.tsx'));
const help = flat(read('./Help.tsx'));

const FALSE_CLAIMS: Array<[string, RegExp]> = [
  // Only the plain denial "no selfie or ID check" may mention a selfie.
  ['selfie', /(?<!no )selfie/i],
  ['liveness', /liveness/i],
  ['age estimation', /age estimation/i],
  ['age gate', /age[\s-]?gate/i],
  ['no account is created', /no (menrush )?account is created/i],
  ['required age check', /required[^.]{0,40}(18\+?|age|veriff)[^.]{0,20}check/i],
  ['signup needs Veriff', /signup (needs|includes|requires)[^.]{0,40}veriff/i],
  ['age passed', /age[\s-]passed/i],
];

describe('Terms and Help do not claim a required selfie or age check while the flag is off', () => {
  for (const [name, page] of [
    ['Terms', terms],
    ['Help', help],
  ] as const) {
    for (const [label, re] of FALSE_CLAIMS) {
      it(`${name} has no "${label}" claim`, () => {
        expect(page).not.toMatch(re);
      });
    }
  }

  it('Terms 1.4 describes date of birth, the 18 or over tick and the optional Veriff check', () => {
    const s14 = terms.slice(terms.indexOf('<Strong>1.4</Strong>'), terms.indexOf('</>', terms.indexOf('<Strong>1.4</Strong>')));
    expect(s14).toMatch(/date of birth/);
    expect(s14).toMatch(/tick a box to confirm you are 18 or over/);
    expect(s14).toMatch(/optional ID check with Veriff/);
    expect(s14).toMatch(/Verified badge/);
    expect(s14).toMatch(/Get verified on the Edit screen in the You tab/);
  });

  it('Help describes date of birth, the 18 or over tick and where Get verified lives', () => {
    expect(help).toMatch(/date of birth/);
    expect(help).toMatch(/18 or over/);
    expect(help).toMatch(/optional Veriff ID check/);
    expect(help).toMatch(/tap Get verified in You > Edit/);
  });

  it('the Get verified location named in the copy really exists', () => {
    expect(read('./Profile.tsx')).toMatch(/<div id="verify">/);
    expect(read('../lib/youRows.ts')).toMatch(/VERIFY_HOME_PATH = `\$\{PROFILE_EDIT_PATH\}#verify`/);
    expect(read('../lib/youRows.ts')).toMatch(/PROFILE_EDIT_PATH = '\/profile\/edit'/);
    expect(read('../components/AccountMenu.tsx')).toMatch(/label: 'Get verified', to: '\/profile\/edit#verify'/);
    expect(read('./You.tsx')).toMatch(/to=\{PROFILE_EDIT_PATH\}/);
  });

  it('Terms Last updated date is set', () => {
    expect(terms).toMatch(/Last updated: 10 October 2026/);
  });
});
