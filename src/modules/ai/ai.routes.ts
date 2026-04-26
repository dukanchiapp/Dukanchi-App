import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { AiController } from './ai.controller';

export const aiRoutes = Router();

aiRoutes.post('/analyze-image', authenticateToken, AiController.analyzeImage);
aiRoutes.post('/transcribe-voice', authenticateToken, AiController.transcribeVoice);
aiRoutes.post('/generate-store-description', authenticateToken, AiController.generateStoreDesc);
