import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { messageService } from '../services/message.service';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { MessageSchema, MediaMessageFormSchema } from '../types/validation';

const router = Router();

router.use(authMiddleware);

// ── Multer storage for message media (images + voice notes) ──────────────
const mediaDir = path.resolve(__dirname, '../../uploads/messages');
fs.mkdirSync(mediaDir, { recursive: true });

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (req: any, file, cb) => {
      const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      // Best-effort extension — multer's file.originalname can be browser-junk
      // for MediaRecorder blobs ("blob"), so fall back to a sensible default.
      let ext = path.extname(file.originalname || '');
      if (!ext) {
        if (file.mimetype.startsWith('audio/')) ext = '.webm';
        else if (file.mimetype.startsWith('image/')) ext = '.jpg';
      }
      cb(null, `msg-${req.userId}-${suffix}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only images or audio are allowed'));
  },
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = MessageSchema.parse(req.body);
    const message = await messageService.sendMessage(req.userId!, data.receiver_id, data.message);

    const io = req.app.get('io');
    io.to(`user:${data.receiver_id}`).emit('message', message);

    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Media (image / voice) — multipart/form-data with a single `media` file
router.post('/media', mediaUpload.single('media'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const parsed = MediaMessageFormSchema.safeParse(req.body);
  if (!parsed.success) {
    // Clean up the orphan file so we don't leak storage on bad requests.
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { receiver_id, kind, caption, disappearing, duration_ms } = parsed.data;
  // Server-side guard: don't allow mime/kind mismatch (frontend could lie).
  if (kind === 'image' && !req.file.mimetype.startsWith('image/')) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'Expected an image upload' });
  }
  if (kind === 'audio' && !req.file.mimetype.startsWith('audio/')) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'Expected an audio upload' });
  }

  const media_url = `/uploads/messages/${req.file.filename}`;
  try {
    const message = await messageService.sendMediaMessage(req.userId!, receiver_id, {
      mediaType: kind,
      mediaUrl: media_url,
      caption,
      disappearing,
      audioDurationMs: duration_ms,
    });

    const io = req.app.get('io');
    io.to(`user:${receiver_id}`).emit('message', message);

    res.status(201).json(message);
  } catch (error: any) {
    // Roll back the upload if the DB insert / match check fails.
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    res.status(400).json({ error: error.message });
  }
});

// Mark a disappearing message as viewed — starts the 10s burn timer.
router.post('/:messageId/view', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await messageService.markMessageViewed(req.userId!, req.params.messageId);
    // Let the sender know the recipient opened it (sender UI shows "Opened").
    const io = req.app.get('io');
    io.to(`user:${updated.sender_id}`).emit('message:viewed', {
      id: updated.id,
      viewed_at: updated.viewed_at,
      expires_at: updated.expires_at,
    });
    res.json(updated);
  } catch (error: any) {
    if (error.message === 'message_not_found_or_not_recipient') {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversation/:otherId', async (req: AuthRequest, res: Response) => {
  try {
    const messages = await messageService.getConversation(req.userId!, req.params.otherId);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await messageService.getConversations(req.userId!);
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
