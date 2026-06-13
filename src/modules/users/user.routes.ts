import { Router } from "express";
import { z } from "zod";
import { UserController } from "./user.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate, validateParams } from "../../../validators/validate";
import { idParamSchema, updateUserProfileBody, uuidLike } from "../../../validators/schemas";

const router = Router();
// Session 128.34: param + body validation wired (was unvalidated before).
// 7 routes use :id (uuid) → idParamSchema; the legacy /:userId/store path
// keeps the userId name → a local schema reuses the same uuid-shape check.
const userIdParam = z.object({ userId: uuidLike });

// Notice: In the old app, these were mounted on app without prefix, so to maintain parity,
// if we mount this router at /api/users, the routes here should be relative to that.
// The previous path was app.get("/api/users/:userId/store")
// Assuming this router is mounted at `app.use('/api/users', userRoutes)`:
router.get("/:userId/store", authenticateToken, validateParams(userIdParam), UserController.getUserStore);
router.get("/:id", authenticateToken, validateParams(idParamSchema), UserController.getUserProfile);
router.put("/:id", authenticateToken, validateParams(idParamSchema), validate(updateUserProfileBody), UserController.updateUserProfile);
router.get("/:id/following", authenticateToken, validateParams(idParamSchema), UserController.getFollowing);
router.get("/:id/saved", authenticateToken, validateParams(idParamSchema), UserController.getSaved);
router.get("/:id/reviews", authenticateToken, validateParams(idParamSchema), UserController.getReviews);
router.get("/:id/search-history", authenticateToken, validateParams(idParamSchema), UserController.getSearchHistory);
router.get("/:id/locations", authenticateToken, validateParams(idParamSchema), UserController.getLocations);

export const userRoutes = router;
