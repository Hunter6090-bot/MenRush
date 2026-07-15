import { Router } from 'express';
const router = Router();

// Simple ICE servers endpoint
router.get('/ice-servers', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add TURN if configured in env
    ]
  });
});

export default router;
