import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canUseDisplayThumb,
  isMenrushProductionHost,
  RAILWAY_PRODUCTION_ORIGIN,
  resolveAssetUrl,
  resolveDisplayThumbCandidates,
  resolveUploadUrlCandidates,
} from './assetUrl';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('assetUrl display thumbs + production upload host', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('canUseDisplayThumb accepts profile/message uploads only', () => {
    expect(canUseDisplayThumb('/uploads/profiles/a.jpg')).toBe(true);
    expect(canUseDisplayThumb('/uploads/messages/b.jpg')).toBe(true);
    expect(canUseDisplayThumb('/avatars/generic/02.svg')).toBe(false);
    expect(canUseDisplayThumb('https://cdn.example/x.jpg')).toBe(false);
  });

  it('resolveDisplayThumbCandidates puts display API first then raw', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://preview.example', hostname: 'preview.example' },
    });
    const c = resolveDisplayThumbCandidates('/uploads/profiles/pete.jpg', 480);
    expect(c[0]).toContain('/api/media/display?src=');
    expect(c[0]).toContain('w=480');
    expect(c[0].startsWith('https://preview.example/api/media/display')).toBe(true);
    expect(c.some((u) => u.includes('/uploads/profiles/pete.jpg') && !u.includes('display'))).toBe(
      true,
    );
  });

  it('resolveUploadUrlCandidates prefers same-origin on non-production hosts', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://preview.example', hostname: 'preview.example' },
    });
    const c = resolveUploadUrlCandidates('/uploads/profiles/x.jpg');
    expect(c[0]).toBe('https://preview.example/uploads/profiles/x.jpg');
  });

  it('resolveUploadUrlCandidates prefers Railway production on menrush.com', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://menrush.com', hostname: 'menrush.com' },
    });
    expect(isMenrushProductionHost('menrush.com')).toBe(true);
    const c = resolveUploadUrlCandidates('/uploads/profiles/x.jpg');
    expect(c[0]).toBe(`${RAILWAY_PRODUCTION_ORIGIN}/uploads/profiles/x.jpg`);
    expect(c).toContain('https://menrush.com/uploads/profiles/x.jpg');
  });

  it('resolveAssetUrl on menrush.com points /uploads at Railway production', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://menrush.com', hostname: 'menrush.com' },
    });
    expect(resolveAssetUrl('/uploads/profiles/al.png')).toBe(
      `${RAILWAY_PRODUCTION_ORIGIN}/uploads/profiles/al.png`,
    );
  });

  it('resolveAssetUrl keeps signed /api media same-origin (chat video open)', () => {
    const path = '/api/messages/abc/media?access=token';
    expect(resolveAssetUrl(path)).toBe(path);
  });

  it('vercel.json rewrites target Railway production (not staging)', () => {
    const raw = readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8');
    const cfg = JSON.parse(raw) as { rewrites: Array<{ source: string; destination: string }> };
    for (const key of ['/api/', '/uploads/', '/socket.io/']) {
      const rule = cfg.rewrites.find((r) => r.source.startsWith(key));
      expect(rule, `missing rewrite for ${key}`).toBeTruthy();
      expect(rule!.destination).toContain(RAILWAY_PRODUCTION_ORIGIN);
      expect(rule!.destination).not.toMatch(/staging/i);
    }
  });
});
