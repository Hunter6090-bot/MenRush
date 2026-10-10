import { Request, Response, NextFunction } from 'express';

/**
 * Viewer-dependent responses (hot-spot counts, activity times, my check-in)
 * must never be stored by a shared cache or the browser.
 */
export const PRIVATE_NO_STORE = 'private, no-store';

export function privateNoStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', PRIVATE_NO_STORE);
  next();
}
