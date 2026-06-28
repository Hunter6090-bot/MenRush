import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { albumService, FREE_PHOTO_CAP } from '../services/album.service';
import { premiumService } from '../services/premium.service';
import { SecurityError } from '../security/access';
import { resolveMediaPath, verifyMediaAccess } from '../security/media';
import { safeUploadFilename, uploadFileFilter, validateFileSignature } from '../security/uploads';
import { CreateAlbumSchema, GrantAlbumSchema } from '../types/validation';

const router = Router();

const uploadsDir = path.resolve(__dirname, '../../uploads/albums');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req: any, file, cb) => {
      try {
        cb(null, safeUploadFilename('album', req.userId, file.mimetype));
      } catch (error) {
        cb(error as Error, '');
      }
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: uploadFileFilter('album'),
});

router.get('/media/:photoId', async (req, res) => {
  try {
    const resource = `/api/albums/media/${req.params.photoId}`;
    const grant = verifyMediaAccess(String(req.query.access || ''), resource);
    const media = await albumService.getMedia(grant.viewerId, req.params.photoId);
    res.type(media.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(resolveMediaPath(uploadsDir, media.storageKey));
  } catch (error) {
    if (error instanceof SecurityError) {
      return res.status(error.status).json({ error: error.code });
    }
    return res.status(404).json({ error: 'media_unavailable' });
  }
});

router.use(authMiddleware, verifiedMiddleware);

// ── Owner: list my albums ───────────────────────────────────────────────────
router.get('/mine', async (req: AuthRequest, res: Response) => {
  try {
    const albums = await albumService.listAlbumsForOwner(req.userId!);
    const totalPhotos = await albumService.countPhotosForUser(req.userId!);
    res.json({ albums, photo_total: totalPhotos, free_cap: FREE_PHOTO_CAP });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = CreateAlbumSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  try {
    const album = await albumService.createAlbum(req.userId!, parsed.data);
    res.json(album);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:albumId', async (req: AuthRequest, res: Response) => {
  try {
    await albumService.deleteAlbum(req.userId!, req.params.albumId);
    res.json({ deleted: true });
  } catch (error: any) {
    if (error.message === 'album_not_owned') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ── Photos ──────────────────────────────────────────────────────────────────
router.post('/:albumId/upload', upload.single('photo'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!(await validateFileSignature(req.file.path, req.file.mimetype))) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'File content does not match its type' });
  }

  // Free-tier cap check. If the user is hitting the cap, tell them so they can upgrade.
  // Premium gating is enforced by the frontend until CCBill entitlements are fully wired.
  const total = await albumService.countPhotosForUser(req.userId!);
  const isPremium = await premiumService.isPremium(req.userId!);
  if (!isPremium && total >= FREE_PHOTO_CAP) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res
      .status(402)
      .json({ error: `Free tier is capped at ${FREE_PHOTO_CAP} private photos. Upgrade for unlimited.` });
  }

  try {
    const photo = await albumService.addPhoto(
      req.userId!,
      req.params.albumId,
      req.file.filename,
      req.file.mimetype,
    );
    res.json(photo);
  } catch (error: any) {
    try { fs.unlinkSync(req.file!.path); } catch { /* ignore */ }
    if (error.message === 'album_not_owned') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:albumId/photos', (_req, res) => {
  return res.status(410).json({ error: 'Direct media URLs are not accepted' });
});

router.get('/:albumId/photos', async (req: AuthRequest, res: Response) => {
  try {
    const result = await albumService.listPhotos(req.params.albumId, req.userId!, false);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'album_not_found') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ── Viewer: list someone else's albums ──────────────────────────────────────
router.get('/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const albums = await albumService.listAlbumsForViewer(req.params.userId, req.userId!);
    res.json({ albums });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Grants ──────────────────────────────────────────────────────────────────
router.post('/:albumId/grant', async (req: AuthRequest, res: Response) => {
  const parsed = GrantAlbumSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  try {
    await albumService.grantAccess(req.userId!, req.params.albumId, parsed.data.viewer_id);
    res.json({ granted: true });
  } catch (error: any) {
    if (error.message === 'album_not_owned') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:albumId/grant/:viewerId', async (req: AuthRequest, res: Response) => {
  try {
    await albumService.revokeAccess(req.userId!, req.params.albumId, req.params.viewerId);
    res.json({ granted: false });
  } catch (error: any) {
    if (error.message === 'album_not_owned') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
