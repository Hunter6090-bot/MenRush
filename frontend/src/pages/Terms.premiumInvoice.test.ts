/**
 * Terms section 7 guard for the manual invoice Premium path (#286/#287).
 * 7.4 and 7.6A are Legal's wording, word for word.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const terms = readFileSync(resolve(__dirname, './Terms.tsx'), 'utf8').replace(/\s+/g, ' ');

const S74 =
  '7.4</Strong> To buy Premium by manual invoice, you pay the invoice by bank transfer using the payment reference shown on it. The invoice shows the full amount you pay us. Premium starts once we have confirmed your payment, and we will tell you when it has started. If your payment has not been matched, email support@menrush.com with your payment reference.';
const S76A =
  '7.6A</Strong> You can cancel your Premium purchase within 14 days of buying it. When you buy, we ask whether you want Premium to start as soon as your payment is confirmed. If you choose that and then cancel within the 14 days, we refund what you paid less an amount for the days of Premium you have had. To cancel, email support@menrush.com with your invoice reference. We refund you within 14 days of you telling us, to the account you paid from.';

const S73 =
  '7.3</Strong> Card payments are not available yet. Before card payment opens, we will update these Terms and tell you who processes card payments. For now, you can buy Premium by manual invoice from the Premium page.';

const S75 =
  '7.5</Strong> Prices are shown in pounds sterling (GBP). The price shown on your invoice is the full amount you pay us, and if VAT applies it is shown there. If we change the price of Premium, the new price applies only to Premium you buy after the change, and you will see it before you pay.';

const S8: Array<[string, string]> = [
  ['8.1', 'You can cancel a Premium purchase within 14 days of buying it, as set out in section 7.6A. If you asked for Premium to start as soon as your payment was confirmed, your refund is reduced for the days of Premium you have had. Otherwise you get a full refund.'],
  ['8.2', 'After those 14 days, we do not refund the rest of a Premium period you have started, unless the law gives you a right to a refund or we have made a mistake.'],
  ['8.3', 'If Premium does not work as described, or we charged you wrongly, please email support@menrush.com and we will put it right, which may include a refund. Nothing in these Terms affects your legal rights.'],
  ['8.4', 'We send refunds to the account you paid from, within 14 days of agreeing them.'],
  ['8.5', 'If we close your account because you broke these Terms, we may not refund unused Premium, except where the law says we must.'],
];

const section7 = () => {
  const start = terms.indexOf('{/* 7. Premium');
  const end = terms.indexOf('{/* 8.');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return terms.slice(start, end);
};

describe('Terms section 7 manual invoice wording', () => {
  it('7.5 is Legal wording exactly', () => {
    expect(terms).toContain(S75);
    expect(terms).not.toMatch(/inclusive of any applicable VAT/i);
  });

  it('section 7 never calls Premium a subscription and nothing in it renews', () => {
    const s7 = section7();
    expect(s7).not.toMatch(/subscri/i);
    expect(s7).not.toMatch(/auto-?renew|(?<!does not )renews? (automatically|unless)|recurring/i);
    expect(s7).toMatch(/does not renew automatically/);
    expect(terms).toMatch(/title: 'Premium' \}/);
    expect(s7).toContain('You buy Premium as a one-off purchase for a fixed period.');
  });

  it('section 8 is Legal wording exactly, titled Refunds and cancellation, with nothing else in it', () => {
    expect(terms).toMatch(/\{ id: 'refunds', number: '8', title: 'Refunds and cancellation' \}/);
    const start = terms.indexOf('{/* 8. Refunds and cancellation */}');
    const end = terms.indexOf('{/* 9.');
    expect(start).toBeGreaterThan(-1);
    const s8 = terms.slice(start, end);
    for (const [n, text] of S8) expect(s8).toContain(`<Strong>${n}</Strong> ${text}`);
    expect((s8.match(/<Strong>8\.\d+<\/Strong>/g) ?? []).length).toBe(S8.length);
  });

  it("no 'non-refundable' or 'waived' anywhere in the Terms, and no 'checkout' in section 7", () => {
    expect(terms).not.toMatch(/non-?refundable/i);
    expect(terms).not.toMatch(/waived?/i);
    expect(section7()).not.toMatch(/checkout/i);
  });

  it('section 7 has no em or en dashes', () => {
    expect(section7()).not.toMatch(/[\u2013\u2014]/);
  });

  it('7.3 is Legal wording exactly, with no recurring billing or merchant review', () => {
    expect(terms).toContain(S73);
    const i73 = terms.indexOf('<Strong>7.3</Strong>');
    const s73 = terms.slice(i73, terms.indexOf('</>', i73));
    expect(s73).not.toMatch(/recurring|merchant review|processor/i);
  });

  it('Terms Last updated is 10 October 2026', () => {
    expect(terms).toMatch(/Last updated: 10 October 2026/);
  });

  it('7.4 is Legal wording exactly, with no recurring billing sentence', () => {
    expect(terms).toContain(S74);
    expect(terms).not.toMatch(/recurring billing/i);
  });

  it('7.6A is Legal wording exactly and sits right after 7.6', () => {
    expect(terms).toContain(S76A);
    const i76 = terms.indexOf('<Strong>7.6</Strong>');
    const i76a = terms.indexOf('<Strong>7.6A</Strong>');
    const i77 = terms.indexOf('<Strong>7.7</Strong>');
    expect(i76).toBeGreaterThan(-1);
    expect(i76a).toBeGreaterThan(i76);
    expect(i77).toBeGreaterThan(i76a);
  });

  it('the /premium tick names the same choice 7.6A describes', () => {
    const premium = readFileSync(resolve(__dirname, './Premium.tsx'), 'utf8');
    expect(premium).toContain(
      'Start my Premium as soon as my payment is confirmed. I understand that if I cancel within 14 days, my refund will be reduced for the days of Premium I have had.',
    );
  });
});
