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
import { authenticateToken, authenticateAny } from "../../middlewares/auth.middleware";
router.get("/me", authenticateAny, AuthController.me);
router.post("/refresh", authenticateToken, AuthController.refresh);

export const authRoutes = router;
