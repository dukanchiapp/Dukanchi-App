import { Router } from 'express';
import { authenticateAdminToken } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/auth.middleware';
import { LandingController } from './landing.controller';

export const landingPublicRoutes = Router();
export const landingAdminRoutes = Router();

landingPublicRoutes.get('/landing-content', LandingController.getContent);
landingAdminRoutes.put('/landing-content', authenticateAdminToken, requireAdmin, LandingController.updateContent);
