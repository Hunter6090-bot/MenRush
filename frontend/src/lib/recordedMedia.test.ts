import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalMediaMime,
  extensionForMediaMime,
  sniffVideoMime,
} from './recordedMedia.ts';

test('strips codec parameters Safari puts on MediaRecorder.mimeType', () => {
  assert.equal(canonicalMediaMime('video/mp4;codecs=avc1.42E01E,mp4a.40.2'), 'video/mp4');
  assert.equal(canonicalMediaMime('video/webm;codecs=vp8,opus'), 'video/webm');
});

test('maps QuickTime to mp4', () => {
  assert.equal(canonicalMediaMime('video/quicktime'), 'video/mp4');
});

test('does not force webm onto iPhone mp4 recordings', () => {
  assert.equal(extensionForMediaMime('video/mp4;codecs=avc1', 'video'), 'mp4');
  assert.equal(extensionForMediaMime('video/webm', 'video'), 'webm');
});

test('detects MP4 ftyp even when the blob was mislabelled as webm', () => {
  const bytes = new Uint8Array(12);
  bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  assert.equal(sniffVideoMime(bytes, 'video/webm'), 'video/mp4');
});

test('detects WebM EBML', () => {
  const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00]);
  assert.equal(sniffVideoMime(bytes, ''), 'video/webm');
});

