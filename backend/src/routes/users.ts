import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { userService } from '../services/user.service';
import { profileViewsService } from '../services/profile-views.service';
import { notificationService } from '../services/notification.service';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { SecurityError } from '../security/access';
import { safeUploadFilename, uploadFileFilter, validateFileSignature } from '../security/uploads';
import { LocationSchema, ProfileSchema } from '../types/validation';

const router = Router();
const uploadsDir = path.resolve(__dirname, '../../uploads/profiles');

fs.mkdirSync(uploadsDir, { recursive: true });

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req: any, file, cb) => {
    try {
      cb(null, safeUploadFilename('profile', req.userId, file.mimetype));
    } catch (error) {
      cb(error as Error, '');
    }
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: uploadFileFilter('profile'),
});

const coverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req: any, file, cb) => {
    try {
      cb(null, safeUploadFilename('cover', req.userId, file.mimetype));
    } catch (error) {
      cb(error as Error, '');
    }
  },
});

const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: uploadFileFilter('cover'),
});

router.use(authMiddleware);

router.post('/photo', verifiedMiddleware, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!(await validateFileSignature(req.file.path, req.file.mimetype))) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File content does not match its type' });
    }

    const photo_url = `/uploads/profiles/${req.file.filename}`;
    const user = await userService.updateProfile(req.userId!, { photo_url });
    
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/cover', verifiedMiddleware, uploadCover.single('cover'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!(await validateFileSignature(req.file.path, req.file.mimetype))) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File content does not match its type' });
    }

    const cover_url = `/uploads/profiles/${req.file.filename}`;
    const user = await userService.updateProfile(req.userId!, { cover_url });

    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.getOwnProfile(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { email: _omit, ...profile } = user;
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await userService.searchProfiles(req.userId!, q);
    res.json(users);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/nearby', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { radius, minAge, maxAge, interests, onlyPulse, lookingFor, mood } = req.query;
    const requestedRadius = radius ? Number.parseFloat(radius as string) : 5;
    if (!Number.isFinite(requestedRadius)) {
      return res.status(400).json({ error: 'Invalid radius' });
    }

    const filters = {
      minAge: minAge ? parseInt(minAge as string) : undefined,
      maxAge: maxAge ? parseInt(maxAge as string) : undefined,
      interests: (interests as string)?.split(',').filter(Boolean),
      onlyPulse: onlyPulse === 'true' || onlyPulse === '1',
      lookingFor: typeof lookingFor === 'string' ? lookingFor : undefined,
      mood: typeof mood === 'string' ? mood : undefined,
    };

    const queryLat = typeof req.query.lat === 'string' ? Number.parseFloat(req.query.lat) : NaN;
    const queryLng = typeof req.query.lng === 'string' ? Number.parseFloat(req.query.lng) : NaN;
    const clientLocation =
      Number.isFinite(queryLat) && Number.isFinite(queryLng)
        ? { lat: queryLat, lng: queryLng }
        : undefined;

    const users = await userService.getNearbyUsers(
      req.userId!,
      Math.min(Math.max(requestedRadius, 0.8), 50),
      filters,
      clientLocation,
    );

    res.json(users);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/profile-views', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const summary = await profileViewsService.getViewersForUser(req.userId!);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile/:id', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const viewerId = req.userId!;
    const targetId = req.params.id;
    const user = await userService.getPublicProfile(viewerId, targetId);
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'user_not_found' });
    }
    res.json(user);

    if (viewerId !== targetId) {
      void (async () => {
        try {
          const { notify } = await profileViewsService.recordView(viewerId, targetId);
          if (!notify) return;
          const viewerName = (await userService.getDisplayName(viewerId)) || 'Someone';
          const io = req.app.get('io');
          await notificationService.notify(io, {
            userId: targetId,
            actorId: viewerId,
            type: 'profile_view',
            title: `${viewerName} viewed your profile`,
            body: 'See who checked you out.',
            linkPath: '/profile',
          });
        } catch (sideEffectError) {
          console.error('[profile-view-side-effect]', sideEffectError);
        }
      })();
    }
  } catch (error: unknown) {
    if (error instanceof SecurityError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[profile-view]', error);
    res.status(500).json({ error: 'Could not load profile' });
  }
});

router.post('/like/:id', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const isMatch = await userService.likeUser(req.userId!, req.params.id);
    const io = req.app.get('io');
    const senderName = (await userService.getDisplayName(req.userId!)) || 'Someone';
    const likedName = (await userService.getDisplayName(req.params.id)) || 'Someone';

    if (isMatch) {
      await notificationService.notify(io, {
        userId: req.userId!,
        actorId: req.params.id,
        type: 'match',
        title: `You matched with ${likedName}`,
        body: 'Say hello while you are both online.',
        linkPath: `/messages/${req.params.id}`,
      });
      await notificationService.notify(io, {
        userId: req.params.id,
        actorId: req.userId!,
        type: 'match',
        title: `You matched with ${senderName}`,
        body: 'Say hello while you are both online.',
        linkPath: `/messages/${req.userId}`,
      });
    } else {
      await notificationService.notify(io, {
        userId: req.params.id,
        actorId: req.userId!,
        type: 'like',
        title: `${senderName} sent you a match`,
        body: 'They are interested in connecting.',
        linkPath: `/profile/${req.userId}`,
      });
    }

    res.json({ match: isMatch });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/matches', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matches = await userService.getMatches(req.userId!);
    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/likes/received/summary', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const summary = await userService.getReceivedLikesSummary(req.userId!);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/location', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = LocationSchema.parse(req.body);
    await userService.updateLocation(req.userId!, data.lat, data.lng);
    const { matchLocationService } = await import('../services/match-location.service');
    void matchLocationService.broadcastLocation(
      req.app.get('io'),
      req.userId!,
      data.lat,
      data.lng,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/profile', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = ProfileSchema.parse(req.body);
    const user = await userService.updateProfile(req.userId!, data);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

const VisibilitySchema = z.object({ is_visible: z.boolean() });

router.patch('/visibility', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = VisibilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  try {
    const { is_visible } = parsed.data;
    await userService.updateVisibility(req.userId!, is_visible);
    res.json({ is_visible });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PulseStartSchema = z.object({
  minutes: z.number().int().min(5).max(480).optional(),
});

router.post('/pulse/start', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = PulseStartSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  try {
    const availableUntil = await userService.startPulse(req.userId!, parsed.data.minutes ?? 90);
    if (!availableUntil) {
      return res.status(400).json({ error: 'Share your location before starting Pulse.' });
    }
    res.json({ available_until: availableUntil });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pulse/stop', verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await userService.stopPulse(req.userId!);
    res.json({ available_until: null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/block/:id', async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Cannot block yourself.' });
  }
  try {
    await userService.blockUser(req.userId!, req.params.id);
    res.json({ blocked: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/block/:id', async (req: AuthRequest, res: Response) => {
  try {
    await userService.unblockUser(req.userId!, req.params.id);
    res.json({ blocked: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const ReportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'fake_profile', 'inappropriate_content', 'underage', 'other']),
  details: z.string().max(1000).optional(),
});

router.post('/report/:id', async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Cannot report yourself.' });
  }
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  try {
    await userService.reportUser(req.userId!, req.params.id, parsed.data.reason, parsed.data.details);
    res.json({ reported: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
