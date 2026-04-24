import { Router } from "express";
import { KycController } from "./kyc.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate } from "../../../validators/validate";
import { submitKycSchema } from "../../../validators/schemas";

const router = Router();

// /api/kyc
router.post("/submit", authenticateToken, validate(submitKycSchema), KycController.submitKyc);
router.get("/status", authenticateToken, KycController.getKycStatus);

export const kycRoutes = router;
