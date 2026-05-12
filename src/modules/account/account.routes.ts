import { Router } from "express";
import { AccountController } from "./account.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate } from "../../../validators/validate";
import { deleteAccountSchema } from "../../../validators/schemas";

const router = Router();

// Soft-delete: marks the account, starts 30-day grace timer, keeps cookies valid
// (frontend handles logout flow after success). Cascade query updates (auth
// middleware reject, query filters) come in Day 2.5 — not today.
router.post("/delete", authenticateToken, validate(deleteAccountSchema), AccountController.requestDeletion);

// Restore: clears the soft-delete fields if within grace period. Auth-gated by
// the same JWT that requested deletion (7-day TTL ≪ 30-day grace).
router.post("/restore", authenticateToken, AccountController.restore);

export const accountRoutes = router;
