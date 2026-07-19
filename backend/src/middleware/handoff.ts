import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export interface HandoffRequest extends Request {
  userId?: string;
  handoffSessionId?: string;
}

export const handoffAuthMiddleware = (
  req: HandoffRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'no_handoff_token' });
  }

  try {
    const decoded = authService.verifyHandoffToken(token);
    if (req.params.sessionId && decoded.sessionId !== req.params.sessionId) {
      return res.status(403).json({ error: 'handoff_session_mismatch' });
    }
    req.userId = decoded.userId;
    req.handoffSessionId = decoded.sessionId;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_handoff_token' });
  }
};