import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { verificationService } from '../services/verification';
import { veriffService } from '../services/veriff.service';

const router = Router();
router.use(authMiddleware);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const [state, progress] = await Promise.all([
      verificationService.getState(req.userId!), veriffService.getProgress(req.userId!),
    ]);
    res.json({
      is_verified: progress.is_verified,
      veriff_status: progress.veriff_status,
      status: progress.is_verified ? 'verified' : progress.veriff_status === 'declined' ? 'rejected' : ['created', 'started', 'submitted', 'review', 'resubmission_requested'].includes(progress.veriff_status || '') ? 'pending' : 'unverified',
      provider: state.verification_provider,
      verified_at: state.verified_at,
      rejection_reason: state.rejection_reason,
      age_assurance_status: state.age_assurance_status,
      age_assured_at: state.age_assured_at,
      authenticity_status: state.authenticity_status,
      authenticity_verified_at: state.authenticity_verified_at,
      trust_level: state.trust_level,
    });
  } catch (err) {
    console.error('[verify] status error:', err);
    res.status(500).json({ error: 'verify_status_failed' });
  }
});


router.all('*', (_req, res) => {
  res.status(410).json({ error: 'verification_moved', message: 'Get verified from your Profile using Veriff.' });
});
export default router;
