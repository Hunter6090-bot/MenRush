import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { userService } from '../services/user.service';
import { AuthRequest, authMiddleware } from '../middleware/auth';
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

router.use(authMiddleware);

router.post('/photo', upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const photo_url = `/uploads/profiles/${req.file.filename}`;
    const user = await userService.updateProfile(req.userId!, { photo_url });
    
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.getUserProfile(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius, minAge, maxAge, interests, onlyPulse } = req.query;

    const locationData = LocationSchema.parse({
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    });

    const filters = {
      minAge: minAge ? parseInt(minAge as string) : undefined,
      maxAge: maxAge ? parseInt(maxAge as string) : undefined,
      interests: (interests as string)?.split(',').filter(Boolean),
      onlyPulse: onlyPulse === 'true' || onlyPulse === '1',
    };

    const users = await userService.getNearbyUsers(
      req.userId!,
      locationData.lat,
      locationData.lng,
      radius ? parseInt(radius as string) : 5,
      filters
    );

    res.json(users);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/profile/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.getUserProfile(req.params.id, false);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/like/:id', async (req: AuthRequest, res: Response) => {
  try {
    const isMatch = await userService.likeUser(req.userId!, req.params.id);
    const io = req.app.get('io');
    
    // Get sender's name for notification
    const sender = await userService.getUserProfile(req.userId!);
    const senderName = sender?.name || 'Someone';

    if (isMatch) {
      // Notify both users about the match
      io.to(`user:${req.userId}`).emit('notification', {
        type: 'match',
        message: 'New Match!',
        userId: req.params.id,
      });
      io.to(`user:${req.params.id}`).emit('notification', {
        type: 'match',
        message: `New Match with ${senderName}!`,
        userId: req.userId,
      });
    } else {
      // Notify the liked user that someone liked them
      io.to(`user:${req.params.id}`).emit('notification', {
        type: 'like',
        message: `${senderName} liked your profile!`,
        userId: req.userId,
      });
    }

    res.json({ match: isMatch });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/matches', async (req: AuthRequest, res: Response) => {
  try {
    const matches = await userService.getMatches(req.userId!);
    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/location', async (req: AuthRequest, res: Response) => {
  try {
    const data = LocationSchema.parse(req.body);
    await userService.updateLocation(req.userId!, data.lat, data.lng);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const data = ProfileSchema.parse(req.body);
    const user = await userService.updateProfile(req.userId!, data);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

const VisibilitySchema = z.object({ is_visible: z.boolean() });

router.patch('/visibility', async (req: AuthRequest, res: Response) => {
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

router.post('/pulse/start', async (req: AuthRequest, res: Response) => {
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

router.post('/pulse/stop', async (req: AuthRequest, res: Response) => {
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
