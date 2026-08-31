import { describe, expect, it } from 'vitest';
import {
  baseMediaMime,
  blobForUpload,
  extensionForMediaMime,
  pickVideoRecorderMime,
} from './mediaMime';

describe('baseMediaMime', () => {
  it('strips codec parameters that break multipart Content-Type', () => {
    expect(baseMediaMime('video/webm;codecs=vp8,opus')).toBe('video/webm');
    expect(baseMediaMime('video/mp4;codecs=avc1.42E01E,mp4a.40.2')).toBe('video/mp4');
    expect(baseMediaMime('audio/webm;codecs=opus')).toBe('audio/webm');
  });

  it('normalises case and whitespace', () => {
    expect(baseMediaMime(' Video/WebM ; codecs=vp8 ')).toBe('video/webm');
  });

  it('returns empty for missing type', () => {
    expect(baseMediaMime(undefined)).toBe('');
    expect(baseMediaMime(null)).toBe('');
    expect(baseMediaMime('')).toBe('');
  });
});

describe('blobForUpload', () => {
  it('rewrites Blob.type to the base MIME so FormData stays busboy-safe', async () => {
    const raw = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], {
      type: 'video/webm;codecs=vp8,opus',
    });
    const clean = blobForUpload(raw);
    expect(clean.type).toBe('video/webm');
    expect(await clean.arrayBuffer()).toEqual(await raw.arrayBuffer());
  });

  it('leaves already-clean blobs alone', () => {
    const raw = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
    expect(blobForUpload(raw)).toBe(raw);
  });
});

describe('extensionForMediaMime', () => {
  it('maps desktop webm and iPhone mp4 correctly', () => {
    expect(extensionForMediaMime('video/webm;codecs=vp8,opus', 'video')).toBe('webm');
    expect(extensionForMediaMime('video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video')).toBe('mp4');
    expect(extensionForMediaMime('audio/webm;codecs=opus', 'audio')).toBe('webm');
  });

  it('falls back by kind when mime is missing', () => {
    expect(extensionForMediaMime('', 'video')).toBe('mp4');
    expect(extensionForMediaMime('', 'audio')).toBe('webm');
    expect(extensionForMediaMime('', 'image')).toBe('jpg');
  });
});

describe('pickVideoRecorderMime', () => {
  it('returns empty when MediaRecorder is unavailable', () => {
    const original = globalThis.MediaRecorder;
    // @ts-expect-error intentional unset for the test
    delete globalThis.MediaRecorder;
    expect(pickVideoRecorderMime()).toBe('');
    globalThis.MediaRecorder = original;
  });
});
