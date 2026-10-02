import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { accessControl, SecurityError } from '../security/access';
import { signedMediaUrl, verifyMediaAccess } from '../security/media';

/** Sign only upload paths already present in the authorized response. */
export function signUploadResponse(value: unknown, viewerId: string): unknown {
  if (typeof value === 'string' && /^\/uploads\/(profiles|messages|albums|room-temp)\/[^?#]+$/.test(value)) return signedMediaUrl(value, viewerId);
  if (Array.isArray(value)) return value.map(item => signUploadResponse(item, viewerId));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, signUploadResponse(item, viewerId)]));
  }
  return value;
}
export function adultMediaResponses(req: AuthRequest, res: Response, next: NextFunction) {
  const json = res.json.bind(res);
  res.json = (body: unknown) => json(req.userId ? signUploadResponse(body, req.userId) : body);
  next();
}
export async function requireUploadGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const grant = verifyMediaAccess(String(req.query.access || ''), `/uploads${req.path}`);
    await accessControl.requireAdult(grant.viewerId);
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  } catch (error) {
    if (error instanceof SecurityError) return next(error);
    res.status(403).json({ error: 'media_authorization_required' });
  }
}
