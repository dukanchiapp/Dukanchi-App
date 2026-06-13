import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { AiController } from './ai.controller';
import { validate } from '../../../validators/validate';
import {
  aiAnalyzeImageBody,
  aiTranscribeVoiceBody,
  aiGenerateStoreDescBody,
} from '../../../validators/schemas';

export const aiRoutes = Router();
// Session 128.34: validation wired (was unvalidated). Schemas enforce required
// fields + MIME-type whitelist + 20MB base64 cap so an unparseable payload
// 400s before reaching the Gemini client.
aiRoutes.post('/analyze-image', authenticateToken, validate(aiAnalyzeImageBody), AiController.analyzeImage);
aiRoutes.post('/transcribe-voice', authenticateToken, validate(aiTranscribeVoiceBody), AiController.transcribeVoice);
aiRoutes.post('/generate-store-description', authenticateToken, validate(aiGenerateStoreDescBody), AiController.generateStoreDesc);
