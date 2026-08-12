import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { roomService } from '../services/room.service';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { SecurityError } from '../security/access';
import { safeUploadFilename, uploadFileFilter, validateFileSignature } from '../security/uploads';
import {
  AddRoomMemberSchema,
  CreateRoomSchema,
  RoomMessageSchema,
  RoomTempIdentitySchema,
} from '../types/validation';
import { PremiumRequiredError } from '../services/premium.service';

const router = Router();

router.use(authMiddleware, verifiedMiddleware);

const tempPhotoDir = path.resolve(__dirname, '../../uploads/room-temp');
fs.mkdirSync(tempPhotoDir, { recursive: true });

const tempPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempPhotoDir),
    filename: (req: any, file, cb) => {
      try {
        cb(null, safeUploadFilename('room-temp', req.userId, file.mimetype));
      } catch (error) {
        cb(error as Error, '');
      }
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: uploadFileFilter('room-temp'),
});

function handleRoomError(res: Response, error: unknown) {
  if (error instanceof PremiumRequiredError) {
    return res.status(402).json({ error: error.code, feature: error.feature });
  }
  if (error instanceof SecurityError) {
    return res.status(error.status).json({ error: error.code });
  }
  const message = error instanceof Error ? error.message : 'Request failed';
  return res.status(400).json({ error: message });
}

// POST / — create a room
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = CreateRoomSchema.parse(req.body);
    const room = await roomService.createRoom(req.userId!, data);
    res.status(201).json(room);
  } catch (error: unknown) {
    if (error instanceof PremiumRequiredError) {
      return res.status(402).json({ error: error.code, feature: error.feature });
    }
    const message = error instanceof Error ? error.message : 'Request failed';
    res.status(400).json({ error: message });
  }
});

// GET / — list user's rooms (+ optionally nearby public rooms via ?lat=&lng=&radius=)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const lat = req.query.lat !== undefined ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng !== undefined ? parseFloat(req.query.lng as string) : undefined;
    const radius = req.query.radius !== undefined ? parseFloat(req.query.radius as string) : undefined;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : undefined;

    const rooms = await roomService.getRooms(req.userId!, { lat, lng, radius, limit });
    res.json(rooms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:roomId — room details
router.get('/:roomId', async (req: AuthRequest, res: Response) => {
  try {
    const room = await roomService.getRoom(req.params.roomId, req.userId!);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:roomId — delete room (owner only)
router.delete('/:roomId', async (req: AuthRequest, res: Response) => {
  try {
    await roomService.deleteRoom(req.userId!, req.params.roomId);
    res.status(204).send();
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

// POST /:roomId/join — join room
router.post('/:roomId/join', async (req: AuthRequest, res: Response) => {
  try {
    await roomService.joinRoom(req.userId!, req.params.roomId);
    res.status(200).json({ message: 'Joined room' });
  } catch (error: unknown) {
    handleRoomError(res, error);
  }
});

// POST /:roomId/members — add a member to a premium group (owner only)
router.post('/:roomId/members', async (req: AuthRequest, res: Response) => {
  try {
    const data = AddRoomMemberSchema.parse(req.body);
    await roomService.addMember(req.userId!, req.params.roomId, data.user_id);
    res.status(201).json({ message: 'Member added' });
  } catch (error: unknown) {
    handleRoomError(res, error);
  }
});

// POST /:roomId/leave — leave room
router.post('/:roomId/leave', async (req: AuthRequest, res: Response) => {
  try {
    await roomService.leaveRoom(req.userId!, req.params.roomId);
    res.status(200).json({ message: 'Left room' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /:roomId/temp-identity — caller's temp identity (if any / saved)
router.get('/:roomId/temp-identity', async (req: AuthRequest, res: Response) => {
  try {
    const member = await roomService.isMember(req.userId!, req.params.roomId);
    if (!member) return res.status(403).json({ error: 'not_a_member' });
    const identity = await roomService.getTempIdentity(req.userId!, req.params.roomId);
    res.json(identity ?? {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:roomId/temp-identity — set/update temp identity (never touches main profile)
router.put('/:roomId/temp-identity', async (req: AuthRequest, res: Response) => {
  try {
    const member = await roomService.isMember(req.userId!, req.params.roomId);
    if (!member) return res.status(403).json({ error: 'not_a_member' });
    const data = RoomTempIdentitySchema.parse(req.body);
    const identity = await roomService.setTempIdentity(req.userId!, req.params.roomId, data);
    res.json(identity);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /:roomId/temp-identity/photo — upload temp photo (room-scoped file; not profile)
router.post(
  '/:roomId/temp-identity/photo',
  tempPhotoUpload.single('photo'),
  async (req: AuthRequest, res: Response) => {
    try {
      const member = await roomService.isMember(req.userId!, req.params.roomId);
      if (!member) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'not_a_member' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      if (!(await validateFileSignature(req.file.path, req.file.mimetype))) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'File content does not match its type' });
      }
      const photo_url = `/uploads/room-temp/${req.file.filename}`;
      res.status(201).json({ photo_url });
    } catch (err: any) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /:roomId/temp-identity/clear — wipe unsaved temp identity (session exit)
router.post('/:roomId/temp-identity/clear', async (req: AuthRequest, res: Response) => {
  try {
    await roomService.clearTempIdentityOnLeave(req.userId!, req.params.roomId);
    res.json({ cleared: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:roomId/temp-identity — manual clear of saved/unsaved identity (immediate)
router.delete('/:roomId/temp-identity', async (req: AuthRequest, res: Response) => {
  try {
    const member = await roomService.isMember(req.userId!, req.params.roomId);
    if (!member) return res.status(403).json({ error: 'not_a_member' });
    await roomService.deleteTempIdentity(req.userId!, req.params.roomId);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:roomId/members — roster for gallery view
router.get('/:roomId/members', async (req: AuthRequest, res: Response) => {
  try {
    const members = await roomService.getMembers(req.params.roomId, req.userId!);
    res.json(members);
  } catch (error: any) {
    res.status(error.message.includes('not a member') ? 403 : 500).json({ error: error.message });
  }
});

// GET /:roomId/messages — paginated message history
router.get('/:roomId/messages', async (req: AuthRequest, res: Response) => {
  try {
    const member = await roomService.isMember(req.userId!, req.params.roomId);
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const before = req.query.before as string | undefined;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : undefined;

    const messages = await roomService.getMessages(req.params.roomId, { before, limit });

    // Update last read for this user
    await roomService.updateLastRead(req.userId!, req.params.roomId);

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /:roomId/messages — send a message
router.post('/:roomId/messages', async (req: AuthRequest, res: Response) => {
  try {
    const data = RoomMessageSchema.parse(req.body);

    const message = await roomService.sendMessage(
      req.userId!,
      req.params.roomId,
      data.message,
      data.reply_to
    );

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    io.to(`room:${req.params.roomId}`).emit('room:message', message);

    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
