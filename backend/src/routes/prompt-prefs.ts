import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { privateNoStore } from '../middleware/noStore';
import { isPromptKey, promptPrefsService } from '../services/prompt-prefs.service';

/**
 * "Don't remind me again" across devices. Owner-only, never cached.
 *
 *   GET /api/prompt-prefs               -> { never: ['install', ...] }
 *   PUT /api/prompt-prefs/:prompt/never -> { never: [...] }
 *
 * :prompt must be one of install, alerts, profile. There is no endpoint to
 * read another member's prefs.
 */
const router = Router();
router.use(privateNoStore, authMiddleware);

const changeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { error: 'Too many changes. Try again in a few minutes.' },
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ never: await promptPrefsService.getNever(req.userId!) });
  } catch {
    res.status(500).json({ error: 'Could not load prompt settings' });
  }
});

router.put('/:prompt/never', changeLimiter, async (req: AuthRequest, res: Response) => {
  const { prompt } = req.params;
  if (!isPromptKey(prompt)) {
    return res.status(400).json({ error: 'unknown_prompt' });
  }
  try {
    res.json({ never: await promptPrefsService.setNever(req.userId!, prompt) });
  } catch {
    res.status(500).json({ error: 'Could not save prompt settings' });
  }
});

export default router;
