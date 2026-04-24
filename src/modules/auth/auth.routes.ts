import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authLimiter } from "../../middlewares/rate-limiter.middleware";
import { validate } from "../../../validators/validate";
import { signupSchema, loginSchema } from "../../../validators/schemas";

const router = Router();

router.post("/users", authLimiter, validate(signupSchema), AuthController.signup);
router.post("/login", authLimiter, validate(loginSchema), AuthController.login);

export const authRoutes = router;
