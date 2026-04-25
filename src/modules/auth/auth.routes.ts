import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authLimiter } from "../../middlewares/rate-limiter.middleware";
import { validate } from "../../../validators/validate";
import { signupSchema, loginSchema } from "../../../validators/schemas";

const router = Router();

router.post("/users", authLimiter, validate(signupSchema), AuthController.signup);
router.post("/login", authLimiter, validate(loginSchema), AuthController.login);
router.post("/logout", AuthController.logout);

// Import authenticateToken for the /me route
import { authenticateToken } from "../../middlewares/auth.middleware";
router.get("/me", authenticateToken, AuthController.me);

export const authRoutes = router;
