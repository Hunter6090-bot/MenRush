import { describe, it, expect } from 'vitest';
import {
  HOT_SPOTS_CONSENT,
  HOT_SPOTS_FACE,
  HOT_SPOTS_FACE_BANNED,
  HOT_SPOTS_FACE_REQUIRED_LINES,
  HOT_SPOTS_HELPER,
  HOT_SPOTS_LEGAL_FACE,
  HOT_SPOTS_MAP_BANNER,
  HOT_SPOTS_MAP_BANNER_REQUIRED,
  HOT_SPOTS_PAGE_BLURB,
} from './cruiseCopy';

describe('cruiseCopy Legal RED quiet face (#258 outdoor live)', () => {
  it('keeps Brand soft-OK Legal draft face exact', () => {
    expect(HOT_SPOTS_LEGAL_FACE).toBe(
      'Map spots include independent venues and outdoor locations. 18+ only. Follow the law and any venue rules. MenRush does not run these places. No illegal activity. Consent first.',
    );
    expect(HOT_SPOTS_MAP_BANNER).toBe(HOT_SPOTS_LEGAL_FACE);
    expect(HOT_SPOTS_FACE).toBe(HOT_SPOTS_LEGAL_FACE);
    expect(HOT_SPOTS_HELPER).toBe(HOT_SPOTS_LEGAL_FACE);
  });

  it('includes every required Legal face line', () => {
    for (const line of HOT_SPOTS_FACE_REQUIRED_LINES) {
      expect(HOT_SPOTS_FACE).toContain(line);
      expect(HOT_SPOTS_MAP_BANNER).toContain(line);
      expect(HOT_SPOTS_PAGE_BLURB).toContain(line);
    }
    for (const line of HOT_SPOTS_MAP_BANNER_REQUIRED) {
      expect(HOT_SPOTS_MAP_BANNER).toContain(line);
    }
  });

  it('kills commercial-only-only and Meet-in-public while outdoor is live', () => {
    expect(HOT_SPOTS_CONSENT).toBe('');
    const blob = `${HOT_SPOTS_FACE} ${HOT_SPOTS_PAGE_BLURB} ${HOT_SPOTS_MAP_BANNER} ${HOT_SPOTS_CONSENT}`.toLowerCase();
    for (const banned of HOT_SPOTS_FACE_BANNED) {
      expect(blob).not.toContain(banned);
    }
  });

  it('uses periods only (no em dash marketing voice)', () => {
    expect(HOT_SPOTS_LEGAL_FACE).not.toContain('—');
    expect(HOT_SPOTS_LEGAL_FACE).not.toContain('·');
  });
});
