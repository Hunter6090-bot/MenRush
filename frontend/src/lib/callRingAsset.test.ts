import { describe, expect, it, vi } from 'vitest';
import {
  CALL_RING_TRIM_CLEARED_MARKER,
  CALL_RING_TRIM_SRC,
  fetchClearedRingManifest,
  incomingRingSourceFromManifest,
  parseClearedRingManifest,
  resolveClearedRingSrc,
} from './callRingAsset';

describe('callRingAsset (Legal GREEN Trim hook)', () => {
  it('documents the canonical future Trim path and clearance marker', () => {
    expect(CALL_RING_TRIM_SRC).toBe('/audio/call-ring.trim.mp3');
    expect(CALL_RING_TRIM_CLEARED_MARKER).toBe('/audio/call-ring.trim.cleared.json');
  });

  it('rejects missing or non-cleared manifests → generic ring', () => {
    expect(parseClearedRingManifest(null)).toBeNull();
    expect(parseClearedRingManifest({})).toBeNull();
    expect(resolveClearedRingSrc(null)).toBeNull();
    expect(resolveClearedRingSrc({ cleared: false })).toBeNull();
    expect(incomingRingSourceFromManifest(null)).toBe('generic');
    expect(incomingRingSourceFromManifest({ cleared: false })).toBe('generic');
  });

  it('accepts cleared same-origin /audio/ src only', () => {
    expect(resolveClearedRingSrc({ cleared: true })).toBe(CALL_RING_TRIM_SRC);
    expect(
      resolveClearedRingSrc({ cleared: true, src: '/audio/call-ring.trim.ogg' }),
    ).toBe('/audio/call-ring.trim.ogg');
    expect(incomingRingSourceFromManifest({ cleared: true })).toBe('asset');
  });

  it('blocks remote / traversal paths (anti-scrape)', () => {
    expect(
      resolveClearedRingSrc({
        cleared: true,
        src: 'https://evil.example/trim.mp3',
      }),
    ).toBeNull();
    expect(
      resolveClearedRingSrc({ cleared: true, src: '/audio/../secret.mp3' }),
    ).toBeNull();
    expect(resolveClearedRingSrc({ cleared: true, src: '/sounds/x.mp3' })).toBeNull();
  });

  it('fetchClearedRingManifest returns null on 404 / network error', async () => {
    const notFound = vi.fn(async () => ({ ok: false, status: 404 }) as Response);
    expect(await fetchClearedRingManifest(notFound as unknown as typeof fetch)).toBeNull();

    const boom = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await fetchClearedRingManifest(boom as unknown as typeof fetch)).toBeNull();
  });

  it('fetchClearedRingManifest parses a cleared Brand marker', async () => {
    const ok = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          cleared: true,
          src: '/audio/call-ring.trim.mp3',
          licenseRef: 'Nokia-written-2026-…',
        }),
      }) as Response,
    );
    const manifest = await fetchClearedRingManifest(ok as unknown as typeof fetch);
    expect(manifest).toEqual({
      cleared: true,
      src: '/audio/call-ring.trim.mp3',
      licenseRef: 'Nokia-written-2026-…',
    });
    expect(resolveClearedRingSrc(manifest)).toBe('/audio/call-ring.trim.mp3');
  });
});
