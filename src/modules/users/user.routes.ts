import { Router } from "express";
import { UserController } from "./user.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";

const router = Router();

// Notice: In the old app, these were mounted on app without prefix, so to maintain parity, 
// if we mount this router at /api/users, the routes here should be relative to that.
// The previous path was app.get("/api/users/:userId/store")
// Assuming this router is mounted at `app.use('/api/users', userRoutes)`:
router.get("/:userId/store", UserController.getUserStore); // NOTE: This wasn't authenticated in monolith!
router.get("/:id", authenticateToken, UserController.getUserProfile);
router.put("/:id", authenticateToken, UserController.updateUserProfile);
router.get("/:id/following", authenticateToken, UserController.getFollowing);
router.get("/:id/saved", authenticateToken, UserController.getSaved);
router.get("/:id/reviews", authenticateToken, UserController.getReviews);
router.get("/:id/search-history", authenticateToken, UserController.getSearchHistory);
router.get("/:id/locations", authenticateToken, UserController.getLocations);

export const userRoutes = router;
