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

  const section = (n: string) => {
    const i = terms.indexOf(`<Strong>${n}</Strong>`);
    return terms.slice(i, terms.indexOf('</>', i)).replace(/<Strong>[^<]*<\/Strong> /, '').trim();
  };

  it("Terms 1.4 is Legal's wording, word for word", () => {
    expect(section('1.4')).toBe(
      'You must be 18 or over to use MenRush. When you register, you give your date of birth, and we do not create an account if it shows you are under 18. This is your own declaration and is not an ID check. You can choose to complete an optional ID check with our provider Veriff to get a Verified tick on your profile. Veriff carries out that check and MenRush does not keep copies of your ID document. A Verified tick shows only that a member chose to complete that check. It does not mean every member is ID checked. We may ask for further age checks at any time and may suspend or close an account if we have reason to believe you are under 18 or do not meet these Terms.',
    );
  });

  it('Terms 3.1 uses the same Veriff line as 1.4', () => {
    expect(section('3.1')).toMatch(/Veriff carries out that check and MenRush does not keep copies of your ID document\./);
    expect(section('3.1')).toMatch(/Get verified on the Edit screen in the You tab/);
  });

  it("Terms 7.3 and 7.5 are Legal's wording, word for word", () => {
    expect(section('7.3')).toBe('Premium cannot be bought yet. We will update these Terms before payment opens.');
    expect(section('7.5')).toBe(
      'Prices are shown in pounds sterling (GBP). The price shown on your invoice or at checkout is the full amount you pay us, and if VAT applies it is shown there. If we change the price of Premium, the new price applies only to Premium you buy after the change, and you will see it before you pay.',
    );
    expect(terms).not.toMatch(/merchant review/i);
    expect(terms).not.toMatch(/inclusive of any applicable VAT/i);
  });

  it("Help answers use Legal's lines on the right questions", () => {
    const answer = (q: string) => {
      const i = help.indexOf(`q: '${q}'`);
      const a = help.indexOf("a: '", i) + 4;
      return help.slice(a, help.indexOf("',", a));
    };
    expect(answer('Who is MenRush for?')).toMatch(
      /You must be 18 or over, and you give your date of birth when you register\.$/,
    );
    expect(answer('How do I get verified?')).toMatch(/^It is optional and is not needed to join\./);
    expect(answer('How do I get verified?')).toMatch(/tap Get verified in You > Edit/);
    expect(answer('How do I get verified?')).toMatch(
      /Veriff carries out that check and MenRush does not keep copies of your ID document\./,
    );
    expect(answer('What is the difference between age check and Verified?')).toBe(
      'Everyone tells us their date of birth when they register, and you must be 18 or over to join. Verified means a member also chose to complete an optional ID check with Veriff. Not every member is ID verified.',
    );
    // Matches backend/src/lib/memberDistance.ts coarseMilesFromMeters: "<1 mi", then Math.round miles.
    expect(answer('Why does location matter?')).toMatch(
      /rounded to the nearest mile, or as under 1 mile when they are closer than that\./,
    );
    expect(help).not.toMatch(/bucketed/i);
  });

  it('the rounding the Help names is what the backend does', () => {
    const src = read('../../../backend/src/lib/memberDistance.ts');
    expect(src).toMatch(/if \(miles < 1\) \{\s*return \{[^}]*distance_label: '<1 mi'/);
    expect(src).toMatch(/Math\.round\(miles\)/);
  });

  it('no em or en dashes and no real-time in Terms or Help copy', () => {
    expect(terms).not.toMatch(/[\u2013\u2014]/);
    expect(help).not.toMatch(/[\u2013\u2014]/);
    expect(help).not.toMatch(/real-time/i);
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
