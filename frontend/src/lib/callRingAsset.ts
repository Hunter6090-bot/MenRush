/**
 * Incoming-call ring asset hook (Legal GREEN interim).
 *
 * Canonical future path for a Nokia-licensed / royalty-clear Trim (or
 * Brand-approved original) file. Nothing under this path is bundled until
 * Bronze Apps UK Limited has a written licence and Brand drops the cleared
 * file + marker. Until then, in-app ring stays the existing Web Audio
 * generic oscillator in `callTones.ts`.
 *
 * RED: do not scrape Google/YouTube/free MP3 sites; do not ship Trim/Nokia
 * audio without a written licence; do not claim "Trim" / "Nokia" in public UI.
 */

/** Public URL for the cleared ring file once Legal/Brand drop it. */
export const CALL_RING_TRIM_SRC = '/audio/call-ring.trim.mp3';

/**
 * Sidecar marker Brand commits *with* the licensed file.
 * Shape: `{ "cleared": true, "src": "/audio/call-ring.trim.mp3", "licenseRef": "…" }`
 * Absence (404) or `cleared: false` → keep generic oscillator / OS notification sound.
 */
export const CALL_RING_TRIM_CLEARED_MARKER = '/audio/call-ring.trim.cleared.json';

export type ClearedRingManifest = {
  cleared: boolean;
  src?: string;
  licenseRef?: string;
};

export type IncomingRingSource = 'asset' | 'generic';

export function parseClearedRingManifest(raw: unknown): ClearedRingManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.cleared !== 'boolean') return null;
  const src = typeof obj.src === 'string' && obj.src.trim() ? obj.src.trim() : undefined;
  const licenseRef =
    typeof obj.licenseRef === 'string' && obj.licenseRef.trim()
      ? obj.licenseRef.trim()
      : undefined;
  return { cleared: obj.cleared, src, licenseRef };
}

/** Resolve playable src only when Legal/Brand marker says cleared. */
export function resolveClearedRingSrc(manifest: ClearedRingManifest | null): string | null {
  if (!manifest || !manifest.cleared) return null;
  const src = manifest.src?.trim() || CALL_RING_TRIM_SRC;
  // Only allow same-origin public audio paths — never remote / scraped URLs.
  if (!src.startsWith('/audio/')) return null;
  if (src.includes('..')) return null;
  return src;
}

export function incomingRingSourceFromManifest(
  manifest: ClearedRingManifest | null,
): IncomingRingSource {
  return resolveClearedRingSrc(manifest) ? 'asset' : 'generic';
}

/**
 * Fetch the clearance marker. Network/parse failure → generic (safe default).
 * Used by in-app tones and mirrored by the service worker for PWA push sound.
 */
export async function fetchClearedRingManifest(
  fetchImpl: typeof fetch = fetch,
): Promise<ClearedRingManifest | null> {
  try {
    const res = await fetchImpl(CALL_RING_TRIM_CLEARED_MARKER, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return parseClearedRingManifest(json);
  } catch {
    return null;
  }
}
