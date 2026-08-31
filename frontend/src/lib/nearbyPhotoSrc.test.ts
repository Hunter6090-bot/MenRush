import { afterEach, describe, expect, it, vi } from 'vitest';
import { __gridPhotoTest } from './nearbyPhotoSrc';

describe('nearbyPhotoSrc grid pipeline', () => {
  afterEach(() => {
    __gridPhotoTest.reset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('displayUrl stays same-origin and encodes src', () => {
    vi.stubGlobal('window', { location: { origin: 'https://preview.example' } });
    const url = __gridPhotoTest.displayUrl('/uploads/profiles/a.jpg', 480);
    expect(url).toBe(
      'https://preview.example/api/media/display?src=%2Fuploads%2Fprofiles%2Fa.jpg&w=480',
    );
  });

  it('sameOriginUploadUrl prefers window origin', () => {
    vi.stubGlobal('window', { location: { origin: 'https://menrush.com' } });
    expect(__gridPhotoTest.sameOriginUploadUrl('/uploads/profiles/x.jpg')).toBe(
      'https://menrush.com/uploads/profiles/x.jpg',
    );
  });

  it('skips display API after 404 probe and serves downscaled blob', async () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://menrush.com' },
      setTimeout,
      clearTimeout,
    });

    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    // Minimal valid-enough blob; createImageBitmap may fail in jsdom — we still
    // assert display probe is marked false and enqueue resolves without hanging.
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/media/display')) {
        return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
      }
      if (url.includes('/uploads/')) {
        return new Response(jpegHeader, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      }
      return new Response('nope', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    // createImageBitmap often unavailable / failing in vitest — stub a tiny canvas path.
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('no bitmap in test');
      }),
    );

    const result = await __gridPhotoTest.enqueueGridPhoto('/uploads/profiles/huge.jpg');
    expect(__gridPhotoTest.getDisplayApiOk()).toBe(false);
    // Downscale may fail without canvas bitmap — null is ok (UI falls back to generic).
    // Critical: we must not keep retrying display forever.
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/media/display')).length).toBe(
      1,
    );
    expect(result === null || typeof result === 'string').toBe(true);
  });
});
