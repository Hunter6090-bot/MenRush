/**
 * Single source of truth for where media files live on disk.
 *
 * Railway production mounts a volume at /app/uploads (see Dockerfile).
 * Override with UPLOADS_ROOT when needed (local, tests, object-storage staging).
 */
import fs from 'fs';
import path from 'path';

const RAILWAY_VOLUME = '/app/uploads';

export function getUploadsRoot(): string {
  const fromEnv = process.env.UPLOADS_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  // Prefer the Railway volume when it exists so redeploys don't wipe photos.
  try {
    if (fs.existsSync(RAILWAY_VOLUME)) {
      return RAILWAY_VOLUME;
    }
  } catch {
    /* ignore */
  }

  // Local / container fallback: backend/uploads (dist → ../../uploads, src → ../uploads)
  // Prefer project root relative to compiled dist/
  const fromDist = path.resolve(__dirname, '../../uploads');
  return fromDist;
}

export function getUploadSubdir(...parts: string[]): string {
  return path.join(getUploadsRoot(), ...parts);
}

export function ensureUploadDirs(): void {
  const root = getUploadsRoot();
  for (const sub of ['profiles', 'messages', 'albums', 'verification']) {
    fs.mkdirSync(path.join(root, sub), { recursive: true });
  }
}

/** Probe write+read on the volume — used by /health and admin media health. */
export async function probeUploadsWritable(): Promise<{
  ok: boolean;
  root: string;
  error?: string;
}> {
  const root = getUploadsRoot();
  const probeDir = path.join(root, '.health');
  const probeFile = path.join(probeDir, `probe-${Date.now()}.txt`);
  const payload = `menrush-media-ok ${new Date().toISOString()}`;
  try {
    fs.mkdirSync(probeDir, { recursive: true });
    fs.writeFileSync(probeFile, payload, 'utf8');
    const read = fs.readFileSync(probeFile, 'utf8');
    fs.unlinkSync(probeFile);
    if (read !== payload) {
      return { ok: false, root, error: 'read_mismatch' };
    }
    return { ok: true, root };
  } catch (err) {
    return {
      ok: false,
      root,
      error: err instanceof Error ? err.message : 'uploads_unwritable',
    };
  }
}
