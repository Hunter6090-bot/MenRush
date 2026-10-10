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

describe('Terms section 7 manual invoice wording', () => {
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
