import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { userService } from '../services/user.service';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { LocationSchema, ProfileSchema } from '../types/validation';

const router = Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles');
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
    const { lat, lng, radius, minAge, maxAge, interests } = req.query;

    const locationData = LocationSchema.parse({
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    });

    const filters = {
      minAge: minAge ? parseInt(minAge as string) : undefined,
      maxAge: maxAge ? parseInt(maxAge as string) : undefined,
      interests: (interests as string)?.split(',').filter(Boolean),
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
    const user = await userService.getUserProfile(req.params.id);
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

export default router;
