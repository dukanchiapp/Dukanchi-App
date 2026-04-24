import { Router } from "express";
import { MiscController } from "./misc.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate } from "../../../validators/validate";
import { submitComplaintSchema, submitReportSchema, createReviewSchema } from "../../../validators/schemas";

export const complaintRoutes = Router();
complaintRoutes.post("/", authenticateToken, validate(submitComplaintSchema), MiscController.submitComplaint);

export const reportRoutes = Router();
reportRoutes.post("/", authenticateToken, validate(submitReportSchema), MiscController.submitReport);

export const reviewRoutes = Router();
reviewRoutes.get("/store/:storeId", MiscController.getStoreReviews);
reviewRoutes.get("/product/:productId", MiscController.getProductReviews);
reviewRoutes.post("/", authenticateToken, validate(createReviewSchema as any), MiscController.createReview);

export const settingsRoutes = Router();
settingsRoutes.get("/", MiscController.getAppSettings);
