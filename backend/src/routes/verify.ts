import { Router, Response } from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { verificationService, DocumentAlreadyUsedError } from '../services/verification.service';
import { safeUploadFilename, uploadFileFilter, validateFileSignature } from '../security/uploads';

const router = Router();
const verificationDir = path.resolve(__dirname, '../../uploads/verification');
fs.mkdirSync(verificationDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, verificationDir),
    filename: (req, file, cb) => {
      try {
        const userId = (req as AuthRequest).userId!;
        cb(null, safeUploadFilename('verification', userId, file.mimetype));
      } catch (err) {
        cb(err as Error, '');
      }
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: uploadFileFilter('verification'),
});

router.use(authMiddleware);

router.post(
  '/submit',
  upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const idFront = files?.id_front?.[0];
    const selfie = files?.selfie?.[0];

    if (!idFront || !selfie) {
      return res.status(400).json({ error: 'missing_files' });
    }

    try {
      const [idValid, selfieValid] = await Promise.all([
        validateFileSignature(idFront.path, idFront.mimetype),
        validateFileSignature(selfie.path, selfie.mimetype),
      ]);

      if (!idValid || !selfieValid) {
        await Promise.allSettled([fsPromises.unlink(idFront.path), fsPromises.unlink(selfie.path)]);
        return res.status(400).json({ error: 'invalid_file_signature' });
      }

      const result = await verificationService.submitVerification(req.userId!, {
        idFrontPath: idFront.path,
        idFrontKey: idFront.filename,
        selfiePath: selfie.path,
        selfieKey: selfie.filename,
      });

      res.json(result);
    } catch (err: any) {
      await Promise.allSettled([fsPromises.unlink(idFront.path), fsPromises.unlink(selfie.path)]);

      if (err?.code === 'already_verified') {
        return res.status(400).json({ error: 'already_verified' });
      }
      if (err instanceof DocumentAlreadyUsedError) {
        return res.status(409).json({ error: 'document_already_used' });
      }
      console.error('[verify] submit error:', err);
      return res.status(500).json({ error: 'verification_submit_failed' });
    }
  },
);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const state = await verificationService.getState(req.userId!);
    res.json({
      is_verified: state.is_verified,
      status: state.verification_status,
      provider: state.verification_provider,
      verified_at: state.verified_at,
      rejection_reason: state.rejection_reason,
    });
  } catch (err) {
    console.error('[verify] status error:', err);
    res.status(500).json({ error: 'verify_status_failed' });
  }
});

export default router;