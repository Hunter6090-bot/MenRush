import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  CHAT_IMAGE_MAX_EDGE,
  CHAT_IMAGE_SKIP_BYTES,
  compressChatImageFile,
} from './imageUpload';

describe('compressChatImageFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exposes aggressive chat targets for Android→iPhone send', () => {
    expect(CHAT_IMAGE_MAX_EDGE).toBeLessThanOrEqual(1080);
    expect(CHAT_IMAGE_SKIP_BYTES).toBeLessThanOrEqual(100_000);
  });

  it('returns small JPEGs unchanged', async () => {
    const tiny = new File([new Uint8Array(20_000)], 'small.jpg', { type: 'image/jpeg' });
    const out = await compressChatImageFile(tiny);
    expect(out).toBe(tiny);
  });

  it('downscales a large PNG via canvas when bitmap resize is unavailable', async () => {
    // Fake a decode path: createImageBitmap fails, Image onload paints a canvas.
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('no bitmap');
      }),
    );

    class FakeImage {
      naturalWidth = 4000;
      naturalHeight = 3000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => undefined,
    });

    const ctx = {
      drawImage: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => {
        cb(new Blob([new Uint8Array(40_000)], { type: 'image/jpeg' }));
      },
    };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return canvas as unknown as HTMLElement;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    });

    const huge = new File([new Uint8Array(2_000_000)], 'cam.png', { type: 'image/png' });
    const out = await compressChatImageFile(huge);
    expect(out.type).toBe('image/jpeg');
    expect(out.size).toBeLessThan(huge.size);
    expect(out.name.endsWith('.jpg')).toBe(true);
  });
});
