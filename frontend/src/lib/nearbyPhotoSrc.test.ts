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

  it('skips display API after 404 probe and walks upload candidates', async () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://menrush.com', hostname: 'menrush.com' },
      setTimeout,
      clearTimeout,
    });

    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/media/display')) {
        return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
      }
      // Same-origin rewrite 404 (staging-drift regression); Railway production wins.
      if (url.startsWith('https://menrush.com/uploads/')) {
        return new Response('nope', { status: 404, headers: { 'content-type': 'application/json' } });
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

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('no bitmap in test');
      }),
    );

    const result = await __gridPhotoTest.enqueueGridPhoto('/uploads/profiles/huge.jpg');
    expect(__gridPhotoTest.getDisplayApiOk()).toBe(false);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('backend-production-d587'))).toBe(
      true,
    );
    expect(result === null || typeof result === 'string').toBe(true);
  });
});
