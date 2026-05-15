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
import { authenticateAny } from "../../middlewares/auth.middleware";
router.get("/me", authenticateAny, AuthController.me);

// /refresh — Day 5 / Session 92. NO middleware on this route: the controller
// reads the refresh cookie (dk_refresh / dk_admin_refresh, NOT dk_token)
// and runs verifyRefreshToken + isUserUnavailable internally. Putting the
// access-token middleware here would be wrong — refresh is supposed to be
// callable when the access token has expired. The Day 2.5 deleted_pending
// carve-out is preserved inside the controller's own user-status check.
router.post("/refresh", AuthController.refresh);

export const authRoutes = router;
