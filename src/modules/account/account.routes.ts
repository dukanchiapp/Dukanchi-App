import { Router } from "express";
import { AccountController } from "./account.controller";
import { authenticateToken, authenticateAllowDeleted } from "../../middlewares/auth.middleware";
import { validate } from "../../../validators/validate";
import { deleteAccountSchema } from "../../../validators/schemas";

const router = Router();

// Soft-delete: marks the account, starts 30-day grace timer. Strict auth —
// only an active user can request deletion. After this call, the user's
// auth-middleware cache is invalidated and subsequent strict-auth requests
// from them will get 401 deleted_pending.
router.post("/delete", authenticateToken, validate(deleteAccountSchema), AccountController.requestDeletion);

// Restore: clears the soft-delete fields if within grace period. Uses the
// PERMISSIVE auth variant — strict auth would 401 the very user who needs
// to call this. authenticateAllowDeleted accepts deleted_pending users and
// still rejects blocked/expired ones (defense in depth alongside the
// controller's own checks).
router.post("/restore", authenticateAllowDeleted, AccountController.restore);

export const accountRoutes = router;
