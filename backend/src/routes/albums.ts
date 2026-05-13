import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { albumService, FREE_PHOTO_CAP } from '../services/album.service';
import { CreateAlbumSchema, AddAlbumPhotoSchema, GrantAlbumSchema } from '../types/validation';

const router = Router();
router.use(authMiddleware);

const uploadsDir = path.resolve(__dirname, '../../uploads/albums');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req: any, file, cb) => {
      const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `album-${req.userId}-${suffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  },
});

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

  // Free-tier cap check. If the user is hitting the cap, tell them so they can upgrade.
  // Premium gating is enforced by the frontend until we wire Stripe-backed entitlements.
  const total = await albumService.countPhotosForUser(req.userId!);
  const isPremium = false; // TODO(billing): replace with users.is_premium when added.
  if (!isPremium && total >= FREE_PHOTO_CAP) {
    return res
      .status(402)
      .json({ error: `Free tier is capped at ${FREE_PHOTO_CAP} private photos. Upgrade for unlimited.` });
  }

  const photo_url = `/uploads/albums/${req.file.filename}`;
  try {
    await albumService.addPhoto(req.userId!, req.params.albumId, photo_url);
    res.json({ photo_url });
  } catch (error: any) {
    if (error.message === 'album_not_owned') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:albumId/photos', async (req: AuthRequest, res: Response) => {
  const parsed = AddAlbumPhotoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

  const total = await albumService.countPhotosForUser(req.userId!);
  const isPremium = false;
  if (!isPremium && total >= FREE_PHOTO_CAP) {
    return res
      .status(402)
      .json({ error: `Free tier is capped at ${FREE_PHOTO_CAP} private photos. Upgrade for unlimited.` });
  }

  try {
    await albumService.addPhoto(req.userId!, req.params.albumId, parsed.data.photo_url);
    res.json({ photo_url: parsed.data.photo_url });
  } catch (error: any) {
    if (error.message === 'album_not_owned') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    res.status(500).json({ error: error.message });
  }
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
