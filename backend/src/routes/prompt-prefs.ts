import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { accountLimiter, userAccountKey } from '../lib/authRateLimits';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { privateNoStore } from '../middleware/noStore';
import { isPromptKey, promptPrefsService } from '../services/prompt-prefs.service';

/**
 * "Don't show again" across devices. Owner-only, never cached.
 *
 *   GET /api/prompt-prefs               -> { never: ['install', ...] }
 *   PUT /api/prompt-prefs/:prompt/never -> { never: [...] }
 *
 * :prompt must be one of install, alerts, profile. There is no endpoint to
 * read another member's prefs: the member always comes from the token.
 *
 * No verifiedMiddleware, on purpose (security-checks lists this router as
 * auth-only): the data is the caller's own prompt choices, holds nothing about
 * any other member, and the prompts are shown before verification finishes
 * (the Get the app sheet renders for any signed-in member). Requiring
 * verification would only stop an unverified member's tick from syncing.
 */
const router = Router();
router.use(privateNoStore, authMiddleware);

/**
 * Changes are capped per member (QC P2 on #357), so members behind one carrier
 * or Vercel egress IP do not share a budget. A loose per-IP ceiling stays on
 * top, the same pattern as sign in.
 */
export const PROMPT_PREFS_MEMBER_MAX = 30;

const changeIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  message: { error: 'Too many changes. Try again in a few minutes.' },
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

const changeMemberLimiter = accountLimiter({
  max: PROMPT_PREFS_MEMBER_MAX,
  key: userAccountKey,
  message: 'Too many changes. Try again in a few minutes.',
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ never: await promptPrefsService.getNever(req.userId!) });
  } catch (err) {
    console.error('[prompt-prefs] read failed', err);
    res.status(500).json({ error: 'Could not load prompt settings' });
  }
});

router.put('/:prompt/never', changeIpLimiter, changeMemberLimiter, async (req: AuthRequest, res: Response) => {
  const { prompt } = req.params;
  if (!isPromptKey(prompt)) {
    return res.status(400).json({ error: 'unknown_prompt' });
  }
  try {
    res.json({ never: await promptPrefsService.setNever(req.userId!, prompt) });
  } catch (err) {
    console.error('[prompt-prefs] save failed', err);
    res.status(500).json({ error: 'Could not save prompt settings' });
  }
});

export default router;
