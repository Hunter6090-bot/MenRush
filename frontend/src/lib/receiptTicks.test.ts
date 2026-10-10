import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RECEIPT_TICK_COLORS, getReceiptTickColor } from './receiptTicks.ts';

describe('MessageReceiptTicks theme colors', () => {
  it('uses exact Brand Soft hex codes for dark/night skins', () => {
    assert.equal(RECEIPT_TICK_COLORS.dark.delivered, '#F0E0C0');
    assert.equal(RECEIPT_TICK_COLORS.dark.read, '#E0A14A');
    assert.equal(getReceiptTickColor(false, 'dark'), '#F0E0C0');
    assert.equal(getReceiptTickColor(true, 'dark'), '#E0A14A');
  });

  it('uses exact Brand Soft hex codes for cream/paper light skins', () => {
    assert.equal(RECEIPT_TICK_COLORS.light.delivered, '#1E1508');
    assert.equal(RECEIPT_TICK_COLORS.light.read, '#8B5A1A');
    assert.equal(getReceiptTickColor(false, 'light'), '#1E1508');
    assert.equal(getReceiptTickColor(true, 'light'), '#8B5A1A');
  });

  it('has zero grey-on-grey', () => {
    const greyPattern = /grey|gray|#888|#6b5035|#a89070|#666|#999/i;
    assert.equal(greyPattern.test(RECEIPT_TICK_COLORS.dark.delivered), false);
    assert.equal(greyPattern.test(RECEIPT_TICK_COLORS.dark.read), false);
    assert.equal(greyPattern.test(RECEIPT_TICK_COLORS.light.delivered), false);
    assert.equal(greyPattern.test(RECEIPT_TICK_COLORS.light.read), false);
  });
});
