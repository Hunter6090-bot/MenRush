import { describe, it, expect } from 'vitest';
import {
  HOT_SPOTS_CONSENT,
  HOT_SPOTS_FACE,
  HOT_SPOTS_FACE_REQUIRED_LINES,
  HOT_SPOTS_HELPER,
  HOT_SPOTS_PAGE_BLURB,
  HOT_SPOTS_RULES,
} from './cruiseCopy';

describe('cruiseCopy Brand face', () => {
  it('includes every required Brand face line', () => {
    for (const line of HOT_SPOTS_FACE_REQUIRED_LINES) {
      expect(HOT_SPOTS_FACE).toContain(line);
      expect(HOT_SPOTS_PAGE_BLURB).toContain(line);
    }
  });

  it('keeps helper + rules composition and consent cue', () => {
    expect(HOT_SPOTS_FACE).toBe(`${HOT_SPOTS_HELPER} ${HOT_SPOTS_RULES}`);
    expect(HOT_SPOTS_CONSENT).toBe('Meet in public · Consent first');
  });

  it('avoids dating-coded and RED outdoor copy', () => {
    const blob = `${HOT_SPOTS_FACE} ${HOT_SPOTS_PAGE_BLURB}`.toLowerCase();
    for (const banned of ['cottage', 'cottaging', 'glory hole', 'truck stop', 'dating', 'soulmate']) {
      expect(blob).not.toContain(banned);
    }
  });
});
