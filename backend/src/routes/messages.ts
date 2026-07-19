import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { messageService } from '../services/message.service';
import { sendPushToUser } from '../services/push.service';
import { notificationService } from '../services/notification.service';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { SecurityError } from '../security/access';
import { resolveMediaPath, verifyMediaAccess } from '../security/media';
import { safeUploadFilename, uploadFileFilter, validateFileSignature } from '../security/uploads';
import { MessageSchema, MediaMessageFormSchema, LocationMessageSchema } from '../types/validation';

const router = Router();

/**
 * Fire-and-forget background push to the recipient. The sender is never the
 * recipient here (we only ever push to `receiver_id`), so this never notifies
 * the sender. The service worker dedupes against any foreground tab, so an
 * active in-app session won't double-notify.
 */
function pushNewMessage(receiverId: string, senderName: string, senderId: string, body: string) {
  void sendPushToUser(receiverId, {
    title: senderName || 'New message',
    body,
    url: `/messages/${senderId}`,
    tag: `msg-${senderId}`,
  }).catch(() => undefined);
}

// ── Multer storage for message media (images + voice notes) ──────────────
const mediaDir = path.resolve(__dirname, '../../uploads/messages');
fs.mkdirSync(mediaDir, { recursive: true });

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (req: any, file, cb) => {
      try {
        cb(null, safeUploadFilename('message', req.userId, file.mimetype));
      } catch (error) {
        cb(error as Error, '');
      }
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: uploadFileFilter('message'),
});

router.get('/:messageId/media', async (req, res) => {
  try {
    const resource = `/api/messages/${req.params.messageId}/media`;
    const grant = verifyMediaAccess(String(req.query.access || ''), resource);
    const media = await messageService.getMedia(grant.viewerId, req.params.messageId);
    res.type(media.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(resolveMediaPath(mediaDir, media.storageKey));
  } catch (error) {
    if (error instanceof SecurityError) {
      return res.status(error.status).json({ error: error.code });
    }
    return res.status(404).json({ error: 'media_unavailable' });
  }
});

router.use(authMiddleware, verifiedMiddleware);

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = MessageSchema.parse(req.body);
    const message = await messageService.sendMessage(req.userId!, data.receiver_id, data.message);

    const io = req.app.get('io');
    io.to(`user:${data.receiver_id}`).emit('message', message);
    pushNewMessage(data.receiver_id, message.sender_name ?? '', req.userId!, message.message);

    const preview =
      message.message.length > 80 ? `${message.message.slice(0, 77)}…` : message.message;
    try {
      await notificationService.notify(io, {
        userId: data.receiver_id,
        actorId: req.userId!,
        type: 'message',
        title: `New message from ${message.sender_name ?? 'someone'}`,
        body: preview,
        linkPath: `/messages/${req.userId}`,
      });
    } catch (notifyErr) {
      console.error('[notification:message]', notifyErr);
    }

    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/location', async (req: AuthRequest, res: Response) => {
  try {
    const data = LocationMessageSchema.parse(req.body);
    const message = await messageService.sendLocationMessage(req.userId!, data.receiver_id, {
      lat: data.lat,
      lng: data.lng,
    });

    const io = req.app.get('io');
    io.to(`user:${data.receiver_id}`).emit('message', message);
    pushNewMessage(data.receiver_id, message.sender_name ?? '', req.userId!, '📍 Shared location');

    try {
      await notificationService.notify(io, {
        userId: data.receiver_id,
        actorId: req.userId!,
        type: 'message',
        title: `${message.sender_name ?? 'Someone'} shared their location`,
        body: 'Tap to open directions in your maps app',
        linkPath: `/messages/${req.userId}`,
      });
    } catch (notifyErr) {
      console.error('[notification:location]', notifyErr);
    }

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

  const { receiver_id, kind, caption, disappearing, max_views, duration_ms } = parsed.data;
  if (!(await validateFileSignature(req.file.path, req.file.mimetype))) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'File content does not match its type' });
  }
  // Server-side guard: don't allow mime/kind mismatch (frontend could lie).
  if (kind === 'image' && !req.file.mimetype.startsWith('image/')) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'Expected an image upload' });
  }
  if (kind === 'audio' && !req.file.mimetype.startsWith('audio/')) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'Expected an audio upload' });
  }

  try {
    const message = await messageService.sendMediaMessage(req.userId!, receiver_id, {
      mediaType: kind,
      storageKey: req.file.filename,
      mimeType: req.file.mimetype,
      caption,
      disappearing,
      maxViews: max_views,
      audioDurationMs: duration_ms,
    });

    const io = req.app.get('io');
    io.to(`user:${receiver_id}`).emit(
      'message',
      messageService.forViewer(message, receiver_id),
    );
    pushNewMessage(
      receiver_id,
      message.sender_name ?? '',
      req.userId!,
      kind === 'image' ? '\u{1F4F7} Photo' : '\u{1F3A4} Voice note',
    );

    try {
      await notificationService.notify(io, {
        userId: receiver_id,
        actorId: req.userId!,
        type: kind === 'image' ? 'photo' : 'voice',
        title:
          kind === 'image'
            ? `${message.sender_name ?? 'Someone'} sent a photo`
            : `${message.sender_name ?? 'Someone'} sent a voice note`,
        body: caption || undefined,
        linkPath: `/messages/${req.userId}`,
      });
    } catch (notifyErr) {
      console.error('[notification:media]', notifyErr);
    }

    res.status(201).json(message);
  } catch (error: any) {
    // Roll back the upload if the DB insert / match check fails.
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    res.status(400).json({ error: error.message });
  }
});

router.post('/:messageId/view', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await messageService.markMessageViewed(req.userId!, req.params.messageId);
    // Let the sender know the recipient opened it (sender UI shows remaining views).
    const io = req.app.get('io');
    io.to(`user:${updated.sender_id}`).emit('message:viewed', {
      id: updated.id,
      viewed_at: updated.viewed_at,
      expires_at: updated.expires_at,
      max_views: updated.max_views,
      view_count: updated.view_count,
      remaining_views: updated.remaining_views ?? null,
      expired: updated.expired,
    });
    res.json(updated);
  } catch (error: any) {
    if (error.message === 'message_not_found_or_not_recipient') {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:messageId/withdraw', async (req: AuthRequest, res: Response) => {
  try {
    const { forSender, forReceiver, receiverId } = await messageService.withdrawMedia(
      req.userId!,
      req.params.messageId,
    );
    const io = req.app.get('io');
    io.to(`user:${receiverId}`).emit('message:withdrawn', forReceiver);
    io.to(`user:${req.userId}`).emit('message:withdrawn', forSender);
    res.json(forSender);
  } catch (error: any) {
    const code = error.message;
    if (code === 'not_sender_or_not_found') {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (code === 'already_withdrawn' || code === 'not_media') {
      return res.status(400).json({ error: code });
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

router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await messageService.getUnreadSummary(req.userId!);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
