import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalMediaMime,
  extensionForMediaMime,
  listVideoRecorderMimeTypes,
  pickVideoRecorderMimeType,
  sniffVideoMime,
} from './recordedMedia.ts';

test('strips codec parameters from Safari and Chrome mime types', () => {
  assert.equal(canonicalMediaMime('video/mp4;codecs=avc1.42E01E,mp4a.40.2'), 'video/mp4');
  assert.equal(canonicalMediaMime('video/webm;codecs=vp8,opus'), 'video/webm');
});

test('maps QuickTime and 3GPP to mp4, matroska to webm', () => {
  assert.equal(canonicalMediaMime('video/quicktime'), 'video/mp4');
  assert.equal(canonicalMediaMime('video/3gpp'), 'video/mp4');
  assert.equal(canonicalMediaMime('video/x-matroska'), 'video/webm');
});

test('extensions match the real container, not a hard-coded webm', () => {
  assert.equal(extensionForMediaMime('video/mp4;codecs=avc1', 'video'), 'mp4');
  assert.equal(extensionForMediaMime('video/webm;codecs=vp8,opus', 'video'), 'webm');
});

test('detects MP4 ftyp even when the blob was mislabelled as webm', () => {
  const bytes = new Uint8Array(12);
  bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  assert.equal(sniffVideoMime(bytes, 'video/webm'), 'video/mp4');
});

test('detects WebM EBML even when the blob was mislabelled as mp4 (Android/Chrome)', () => {
  const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00]);
  assert.equal(sniffVideoMime(bytes, 'video/mp4'), 'video/webm');
  assert.equal(sniffVideoMime(bytes, ''), 'video/webm');
});

test('Chrome-like engines prefer WebM when that is what they support', () => {
  const original = globalThis.MediaRecorder;
  (globalThis as any).MediaRecorder = {
    isTypeSupported(type: string) {
      return type.startsWith('video/webm');
    },
  };
  try {
    const list = listVideoRecorderMimeTypes();
    assert.ok(list.every((t) => t.startsWith('video/webm')));
    assert.equal(pickVideoRecorderMimeType().startsWith('video/webm'), true);
  } finally {
    (globalThis as any).MediaRecorder = original;
  }
});

test('Safari-like engines prefer MP4 when that is what they support', () => {
  const original = globalThis.MediaRecorder;
  const originalNav = globalThis.navigator;
  (globalThis as any).MediaRecorder = {
    isTypeSupported(type: string) {
      return type.startsWith('video/mp4');
    },
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', platform: 'iPhone', maxTouchPoints: 5 },
  });
  try {
    assert.equal(pickVideoRecorderMimeType().startsWith('video/mp4'), true);
  } finally {
    (globalThis as any).MediaRecorder = original;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNav });
  }
});
