import { Router } from 'express';
import { authenticateAdminToken } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/auth.middleware';
import { LandingController } from './landing.controller';
import { validate } from '../../../validators/validate';
import { updateLandingContentBody } from '../../../validators/schemas';

export const landingPublicRoutes = Router();
export const landingAdminRoutes = Router();

landingPublicRoutes.get('/landing-content', LandingController.getContent);
// Session 128.34: admin PUT body validated — content must be a plain object
// (not a primitive / array / null which would crash the JSON-merge in the
// service). The public GET takes no input.
landingAdminRoutes.put('/landing-content', authenticateAdminToken, requireAdmin, validate(updateLandingContentBody), LandingController.updateContent);
