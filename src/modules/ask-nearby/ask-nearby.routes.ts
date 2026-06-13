import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { AskNearbyController } from './ask-nearby.controller';
import { validate } from '../../../validators/validate';
import { askNearbySendBody, askNearbyRespondBody } from '../../../validators/schemas';

export const askNearbyRoutes = Router();
// Session 128.34: body validation wired on the two POST endpoints (was
// unvalidated). The 3 GET endpoints take no client input. send enforces
// query/radius/coord bounds + an images[] cap; respond enforces uuid + yes/no.
askNearbyRoutes.post('/send', authenticateToken, validate(askNearbySendBody), AskNearbyController.send);
askNearbyRoutes.post('/respond', authenticateToken, validate(askNearbyRespondBody), AskNearbyController.respond);
askNearbyRoutes.get('/my-requests', authenticateToken, AskNearbyController.myRequests);
askNearbyRoutes.get('/pending', authenticateToken, AskNearbyController.getPending);
askNearbyRoutes.get('/limit-status', authenticateToken, AskNearbyController.getLimitStatus);
