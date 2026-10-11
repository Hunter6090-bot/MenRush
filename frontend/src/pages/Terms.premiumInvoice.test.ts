/**
 * Terms section 7 guard for the manual invoice Premium path (#286/#287).
 * 7.4 and 7.6A are Legal's wording, word for word.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source text with the mail link component read as its text, so wording checks stay word for word.
const terms = readFileSync(resolve(__dirname, './Terms.tsx'), 'utf8')
  .replace(/\s+/g, ' ')
  .replace(/\{' '\}/g, ' ')
  .replace(/<MailLink \/>/g, 'support@menrush.com')
  .replace(/ {2,}/g, ' ');

const S74 =
  '7.4</Strong> To buy Premium by manual invoice, you pay the invoice by bank transfer using the payment reference shown on it. The invoice shows the full amount you pay us. When Premium starts depends on the choice you make when you buy, as set out in section 7.6A. We will tell you when your Premium has started. If your payment has not been matched, email support@menrush.com with your payment reference.';
/** Legal's 7.6A, in its four parts (intro, (a), (b), how to cancel). */
const S76A_PARTS = [
  '7.6A</Strong> You can cancel your Premium purchase within 14 days of buying it. When you buy, you choose when Premium starts:',
  '(a) If you tick the box asking for Premium to start straight away, it starts once we have confirmed your payment. If you then cancel within the 14 days, we refund what you paid less an amount for the days of Premium you have had.',
  '(b) If you leave the box unticked, Premium starts when the 14 days end, or when we confirm your payment if that is later. If you cancel within the 14 days, we refund what you paid in full.',
  'To cancel, email support@menrush.com with your invoice reference. We refund you within 14 days of you telling us, to the account you paid from.',
];

const S73 =
  '7.3</Strong> At times we may include Premium free for all members. While it is included free, there is nothing to buy and we will not charge you for it. The Premium page shows which applies. When Premium can be bought, you buy it by manual invoice from the Premium page, as set out in section 7.4. Card payments are not available yet. Before card payment opens, we will update these Terms and tell you who processes card payments. If we stop including Premium free for all members, we will tell you at least 14 days before, and we will only charge you if you choose to buy it.';

const S76 =
  '7.6</Strong> When you buy Premium, it runs for the period you have paid for and does not renew automatically. When that period ends, Premium stops unless you buy it again. You can cancel an unpaid invoice on the Premium page. Free Premium for all members does not renew or charge you either, and ending it does not affect any Premium you have already paid for or any separate free Premium we have promised you, such as an offer code you have redeemed.';

const S75 =
  '7.5</Strong> Prices are shown in pounds sterling (GBP). The price shown on your invoice is the full amount you pay us, and if VAT applies it is shown there. If we change the price of Premium, the new price applies only to Premium you buy after the change, and you will see it before you pay.';

const S8: Array<[string, string]> = [
  ['8.1', 'You can cancel a Premium purchase within 14 days of buying it, as set out in section 7.6A. If you asked for Premium to start straight away, your refund is reduced for the days of Premium you have had. If you did not, you get a full refund.'],
  ['8.2', 'After those 14 days, we do not refund the rest of a Premium period you have started, unless the law gives you a right to a refund or we have made a mistake.'],
  ['8.3', 'If Premium does not work as described, or we charged you wrongly, please email support@menrush.com and we will put it right, which may include a refund. Nothing in these Terms affects your legal rights.'],
  ['8.4', 'If you cancel within the 14 days, we refund you within 14 days of you telling us you are cancelling. Any other refund we agree is paid within 14 days of us agreeing it. We send refunds to the account you paid from.'],
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

  it('Terms Last updated is 11 October 2026', () => {
    expect(terms).toMatch(/Last updated: 11 October 2026/);
  });

  it('7.6 is Legal wording exactly', () => {
    expect(terms).toContain(S76);
    expect(terms).not.toMatch(/unless you pay a new invoice/);
  });

  it('8.4 and 7.6A agree on refund timing for a cancellation (14 days from telling us)', () => {
    expect(terms).toContain('We refund you within 14 days of you telling us, to the account you paid from.');
    expect(terms).toContain('If you cancel within the 14 days, we refund you within 14 days of you telling us you are cancelling.');
    expect(terms).not.toMatch(/within 14 days of agreeing them/);
  });

  it('the Premium page matches 7.3: while Premium is included free it says there is nothing to buy', () => {
    const premium = readFileSync(resolve(__dirname, './Premium.tsx'), 'utf8').replace(/&apos;/g, "'");
    expect(premium).toContain("Premium is included free for everyone at the moment, so there's nothing to buy.");
    expect(premium).toMatch(/statusRes\.data\.beta_premium_included/);
  });

  it('7.4 is Legal wording exactly, with no recurring billing sentence', () => {
    expect(terms).toContain(S74);
    expect(terms).not.toMatch(/recurring billing/i);
  });

  it('7.6A is Legal wording exactly, in order, and sits right after 7.6', () => {
    let at = -1;
    for (const part of S76A_PARTS) {
      const i = terms.indexOf(part);
      expect(i, part).toBeGreaterThan(at);
      at = i;
    }
    expect(terms).not.toMatch(/we ask whether you want Premium to start/);
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
      'Start my Premium as soon as my payment is confirmed. I understand that if I cancel within 14 days, my refund will be reduced for the days of Premium I have had. If I leave this unticked, Premium starts after the 14 day cancellation period.',
    );
  });

  it('every support@menrush.com in the Terms is a mailto link', () => {
    const raw = readFileSync(resolve(__dirname, './Terms.tsx'), 'utf8');
    const body = raw.slice(raw.indexOf('export const Terms'));
    const bare = body.replace(/<MailLink \/>/g, '').match(/support@menrush\.com/g) ?? [];
    expect(bare).toHaveLength(0);
    expect((body.match(/<MailLink \/>/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
