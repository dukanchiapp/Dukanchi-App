import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authLimiter } from "../../middlewares/rate-limiter.middleware";
import { validate } from "../../../validators/validate";
import { signupSchema, loginSchema } from "../../../validators/schemas";

const router = Router();

router.post("/users", authLimiter, validate(signupSchema), AuthController.signup);
router.post("/login", authLimiter, validate(loginSchema), AuthController.login);
router.post("/logout", AuthController.logout);

// /me is called by both the main app (dk_token) and admin panel (dk_admin_token)
import { authenticateAny, authenticateAllowDeleted } from "../../middlewares/auth.middleware";
router.get("/me", authenticateAny, AuthController.me);

// /refresh uses the PERMISSIVE variant — a user in their 30-day deletion
// grace window must still be able to refresh their session so they can
// reach /api/account/restore beyond the original 7-day JWT TTL. Blocked
// users and fully-expired-grace users are still rejected by the middleware.
// Defense in depth: AuthService.issueTokenForUser will be tightened in
// Step 4 to mirror this policy in the service layer too.
router.post("/refresh", authenticateAllowDeleted, AuthController.refresh);

export const authRoutes = router;
