/**
 * Nearby / Matches grid photos on phones.
 *
 * Live Railway still serves 1.7–2.6MB camera JPEGs (and some /uploads 404).
 * iPhone was blank/slow decoding those; walking missing `/api/media/display`
 * candidates made it worse until the backend ships.
 *
 * Strategy:
 * 1. Probe display API once per session (same-origin). Use it when alive.
 * 2. Otherwise fetch the upload, `createImageBitmap` resize to ~480px, blob URL.
 * 3. Cap concurrent fetches so one Discover open does not decode 10× multi‑MB files.
 * 4. Fail fast → age-based generic avatar (never leave a blank tile).
 */
import { useEffect, useState } from 'react';
import {
  fallbackAvatarForAge,
  getApiOrigin,
  resolveAssetUrl,
} from './assetUrl';

const MAX_EDGE = 480;
const MAX_IN_FLIGHT = 3;
const DISPLAY_PROBE_MS = 1600;
const FETCH_TIMEOUT_MS = 12_000;

type Job = {
  path: string;
  resolve: (url: string | null) => void;
};

const queue: Job[] = [];
let inFlight = 0;
let displayApiOk: boolean | null = null;
let displayProbe: Promise<boolean> | null = null;
const memoryCache = new Map<string, string>();

function sameOriginUploadUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${p}`;
  const api = getApiOrigin();
  return api ? `${api}${p}` : p;
}

function displayUrl(path: string, w: number): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const origin =
    typeof window !== 'undefined' ? window.location.origin : getApiOrigin() || '';
  return `${origin}/api/media/display?src=${encodeURIComponent(p)}&w=${w}`;
}

async function probeDisplayApi(samplePath: string): Promise<boolean> {
  if (displayApiOk != null) return displayApiOk;
  if (displayProbe) return displayProbe;
  displayProbe = (async () => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), DISPLAY_PROBE_MS);
    try {
      const res = await fetch(displayUrl(samplePath, 64), {
        method: 'GET',
        signal: ctrl.signal,
        credentials: 'omit',
      });
      const ct = res.headers.get('content-type') || '';
      const ok = res.ok && ct.includes('image');
      displayApiOk = ok;
      return ok;
    } catch {
      displayApiOk = false;
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  })();
  return displayProbe;
}

async function blobToDownscaledObjectUrl(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: MAX_EDGE,
      resizeHeight: MAX_EDGE,
      resizeQuality: 'medium',
    } as ImageBitmapOptions);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const out: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72),
    );
    if (!out) return null;
    return URL.createObjectURL(out);
  } catch {
    // Safari sometimes rejects resize options — try plain decode + draw.
    try {
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return null;
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const out: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72),
      );
      if (!out) return null;
      return URL.createObjectURL(out);
    } catch {
      return null;
    }
  }
}

async function loadOne(path: string): Promise<string | null> {
  const cached = memoryCache.get(path);
  if (cached) return cached;

  const useDisplay = await probeDisplayApi(path);
  if (useDisplay) {
    const url = displayUrl(path, MAX_EDGE);
    memoryCache.set(path, url);
    return url;
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sameOriginUploadUrl(path), {
      signal: ctrl.signal,
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.startsWith('image/')) return null;
    const blob = await res.blob();
    if (blob.size < 32) return null;
    // Small enough already — object URL without canvas.
    if (blob.size <= 120_000) {
      const url = URL.createObjectURL(blob);
      memoryCache.set(path, url);
      return url;
    }
    const url = await blobToDownscaledObjectUrl(blob);
    if (!url) return null;
    memoryCache.set(path, url);
    return url;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function pumpQueue() {
  while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {
    const job = queue.shift()!;
    inFlight += 1;
    void loadOne(job.path)
      .then((url) => job.resolve(url))
      .finally(() => {
        inFlight -= 1;
        pumpQueue();
      });
  }
}

function enqueueGridPhoto(path: string): Promise<string | null> {
  const cached = memoryCache.get(path);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    queue.push({ path, resolve });
    pumpQueue();
  });
}

function isUploadPath(url: string): boolean {
  return url.startsWith('/uploads/');
}

export type GridPhotoPhase = 'loading' | 'ready' | 'fallback' | 'empty';

/**
 * Grid/list photo resolver for Nearby + Matches (phone-critical).
 * Avatars resolve sync; uploads go through display/downscale queue.
 */
export function useGridPhotoSrc(
  photoUrl?: string | null,
  age?: number,
): { src: string | undefined; phase: GridPhotoPhase } {
  const [src, setSrc] = useState<string | undefined>(() => {
    if (!photoUrl) return undefined;
    const trimmed = photoUrl.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('/avatars/') || trimmed.startsWith('data:') || /^https?:/i.test(trimmed)) {
      return resolveAssetUrl(trimmed);
    }
    return undefined;
  });
  const [phase, setPhase] = useState<GridPhotoPhase>(() => {
    if (!photoUrl?.trim()) return 'empty';
    const t = photoUrl.trim();
    if (t.startsWith('/avatars/') || t.startsWith('data:') || /^https?:/i.test(t)) return 'ready';
    if (isUploadPath(t)) return 'loading';
    return resolveAssetUrl(t) ? 'ready' : 'empty';
  });

  useEffect(() => {
    let cancelled = false;
    const trimmed = photoUrl?.trim() || '';
    if (!trimmed) {
      setSrc(undefined);
      setPhase('empty');
      return;
    }

    if (trimmed.startsWith('/avatars/') || trimmed.startsWith('data:') || /^https?:/i.test(trimmed)) {
      setSrc(resolveAssetUrl(trimmed));
      setPhase('ready');
      return;
    }

    if (!isUploadPath(trimmed)) {
      const resolved = resolveAssetUrl(trimmed);
      setSrc(resolved);
      setPhase(resolved ? 'ready' : 'empty');
      return;
    }

    setPhase('loading');
    setSrc(undefined);
    void enqueueGridPhoto(trimmed).then((url) => {
      if (cancelled) return;
      if (url) {
        setSrc(url);
        setPhase('ready');
        return;
      }
      const generic = resolveAssetUrl(fallbackAvatarForAge(age));
      setSrc(generic);
      setPhase(generic ? 'fallback' : 'empty');
    });

    return () => {
      cancelled = true;
    };
  }, [photoUrl, age]);

  return { src, phase };
}

/** Test helpers */
export const __gridPhotoTest = {
  reset() {
    queue.length = 0;
    inFlight = 0;
    displayApiOk = null;
    displayProbe = null;
    memoryCache.clear();
  },
  getDisplayApiOk: () => displayApiOk,
  setDisplayApiOk: (v: boolean | null) => {
    displayApiOk = v;
  },
  enqueueGridPhoto,
  sameOriginUploadUrl,
  displayUrl,
};
