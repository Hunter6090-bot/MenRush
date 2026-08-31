import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canUseDisplayThumb,
  resolveDisplayThumbCandidates,
  resolveUploadUrlCandidates,
} from './assetUrl';

describe('assetUrl display thumbs + same-origin prefer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('canUseDisplayThumb accepts profile/message uploads only', () => {
    expect(canUseDisplayThumb('/uploads/profiles/a.jpg')).toBe(true);
    expect(canUseDisplayThumb('/uploads/messages/b.jpg')).toBe(true);
    expect(canUseDisplayThumb('/avatars/generic/02.svg')).toBe(false);
    expect(canUseDisplayThumb('https://cdn.example/x.jpg')).toBe(false);
  });

  it('resolveDisplayThumbCandidates puts display API first then raw', () => {
    vi.stubGlobal('window', { location: { origin: 'https://menrush.com' } });
    const c = resolveDisplayThumbCandidates('/uploads/profiles/pete.jpg', 480);
    expect(c[0]).toContain('/api/media/display?src=');
    expect(c[0]).toContain('w=480');
    expect(c[0].startsWith('https://menrush.com/api/media/display')).toBe(true);
    expect(c.some((u) => u.includes('/uploads/profiles/pete.jpg') && !u.includes('display'))).toBe(
      true,
    );
  });

  it('resolveUploadUrlCandidates prefers same-origin before Railway', () => {
    vi.stubGlobal('window', { location: { origin: 'https://menrush.com' } });
    const c = resolveUploadUrlCandidates('/uploads/profiles/x.jpg');
    expect(c[0]).toBe('https://menrush.com/uploads/profiles/x.jpg');
  });
});
