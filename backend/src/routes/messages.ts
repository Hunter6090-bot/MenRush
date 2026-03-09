import { Router, Response } from 'express';
import { messageService } from '../services/message.service';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { MessageSchema } from '../types/validation';

const router = Router();

router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = MessageSchema.parse(req.body);
    const message = await messageService.sendMessage(
      req.userId!,
      data.receiver_id,
      data.message
    );
    
    // Emit real-time message through socket
    const io = req.app.get('io');
    io.to(`user:${data.receiver_id}`).emit('message', message);
    
    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/conversation/:otherId', async (req: AuthRequest, res: Response) => {
  try {
    const messages = await messageService.getConversation(
      req.userId!,
      req.params.otherId
    );
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
