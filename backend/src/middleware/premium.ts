import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { PremiumFeature, PremiumRequiredError, premiumService } from '../services/premium.service';

export const requirePremium =
  (feature?: PremiumFeature) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (feature) {
        await premiumService.requireFeature(req.userId!, feature);
      } else if (!(await premiumService.isPremium(req.userId!))) {
        throw new PremiumRequiredError(
          'premium_required',
          'unlimited_photos',
          'Premium subscription required',
        );
      }
      next();
    } catch (error) {
      if (error instanceof PremiumRequiredError) {
        return res.status(402).json({
          error: error.code,
          feature: error.feature,
        });
      }
      next(error);
    }
  };