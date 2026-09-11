import { describe, expect, it } from 'vitest';
import {
  VIDEO_LOAD_TIMEOUT_MS,
  chatMediaPath,
  chatVideoUnsupportedHint,
  isAppleIncompatibleVideoMime,
} from './chatVideoPlayback';

describe('chatVideoPlayback', () => {
  it('strips signed access tokens from media paths', () => {
    expect(chatMediaPath('/api/messages/abc/media?access=foo.bar')).toBe(
      '/api/messages/abc/media',
    );
    expect(chatMediaPath(null)).toBe('');
  });

  it('flags WebM as Apple-incompatible', () => {
    expect(isAppleIncompatibleVideoMime('video/webm')).toBe(true);
    expect(isAppleIncompatibleVideoMime('video/webm;codecs=vp8,opus')).toBe(true);
    expect(isAppleIncompatibleVideoMime('video/mp4')).toBe(false);
    expect(isAppleIncompatibleVideoMime(undefined)).toBe(false);
  });

  it('keeps a finite load timeout so stuck downloads surface retry UI', () => {
    expect(VIDEO_LOAD_TIMEOUT_MS).toBeGreaterThan(5_000);
    expect(VIDEO_LOAD_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it('chatVideoUnsupportedHint is null for MP4', () => {
    expect(chatVideoUnsupportedHint('video/mp4')).toBeNull();
  });
});
