import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { generateImage } from '../services/imagen.service';

const router = Router();

const GenerateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(2000, 'Prompt too long'),
  numberOfImages: z.number().int().min(1).max(4).optional().default(1),
});

// POST /api/ai/generate-image
// Requires authentication — only logged-in users can generate images.
router.post(
  '/generate-image',
  authMiddleware,
  async (req: Request, res: Response) => {
    const parsed = GenerateImageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { prompt, numberOfImages } = parsed.data;

    try {
      const results = await generateImage(prompt, numberOfImages);

      // Return array of { imageBase64, mimeType } objects.
      // The frontend can render them as data URIs:
      //   <img src={`data:${mimeType};base64,${imageBase64}`} />
      res.json({ images: results });
    } catch (err: any) {
      console.error('[Imagen] Error:', err?.message ?? err);
      const isApiError =
        err?.message?.includes('API key') ||
        err?.message?.includes('PERMISSION') ||
        err?.message?.includes('quota');
      res.status(isApiError ? 400 : 500).json({
        error: err?.message ?? 'Image generation failed',
      });
    }
  }
);

export default router;
