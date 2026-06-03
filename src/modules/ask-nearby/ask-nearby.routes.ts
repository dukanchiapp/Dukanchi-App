import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { AskNearbyController } from './ask-nearby.controller';

export const askNearbyRoutes = Router();

askNearbyRoutes.post('/send', authenticateToken, AskNearbyController.send);
askNearbyRoutes.post('/respond', authenticateToken, AskNearbyController.respond);
askNearbyRoutes.get('/my-requests', authenticateToken, AskNearbyController.myRequests);
askNearbyRoutes.get('/pending', authenticateToken, AskNearbyController.getPending);
askNearbyRoutes.get('/limit-status', authenticateToken, AskNearbyController.getLimitStatus);
