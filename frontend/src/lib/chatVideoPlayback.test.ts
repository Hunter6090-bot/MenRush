import { describe, expect, it } from 'vitest';
import {
  VIDEO_LOAD_TIMEOUT_MS,
  chatMediaPath,
  chatVideoUnsupportedHint,
  isAppleIncompatibleVideoMime,
  resolveChatVideoPlayUrl,
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

  it('keeps a short hard timeout so stuck downloads surface retry UI fast', () => {
    expect(VIDEO_LOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(2_000);
    expect(VIDEO_LOAD_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  it('chatVideoUnsupportedHint is null for MP4', () => {
    expect(chatVideoUnsupportedHint('video/mp4')).toBeNull();
  });

  it('streams the thread signed URL first; refresh only when preferred', () => {
    expect(
      resolveChatVideoPlayUrl({
        threadUrl: '/api/messages/1/media?access=thread',
        refreshedUrl: '/api/messages/1/media?access=fresh',
        preferRefresh: false,
      }),
    ).toBe('/api/messages/1/media?access=thread');

    expect(
      resolveChatVideoPlayUrl({
        threadUrl: '/api/messages/1/media?access=thread',
        refreshedUrl: '/api/messages/1/media?access=fresh',
        preferRefresh: true,
      }),
    ).toBe('/api/messages/1/media?access=fresh');

    expect(
      resolveChatVideoPlayUrl({
        threadUrl: null,
        refreshedUrl: '/api/messages/1/media?access=fresh',
        preferRefresh: false,
      }),
    ).toBe('/api/messages/1/media?access=fresh');
  });
});
