import { Router } from "express";
import { z } from "zod";
import { TeamController } from "./team.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate, validateParams } from "../../../validators/validate";
import { idParamSchema, addTeamMemberBody, uuidLike } from "../../../validators/schemas";

const router = Router();
// Session 128.34: validation wired (was unvalidated). storeId/id params are
// UUIDs (Store.id + TeamMember.id). The legacy "Phone and password are
// required" / "Password must be at least 4 characters" string-message paths
// in team.controller's catch block still work — addTeamMemberBody just
// returns the same 400 (with structured `issues`) earlier in the chain.
const storeIdParam = z.object({ storeId: uuidLike });

// /api/team
router.get("/:storeId", authenticateToken, validateParams(storeIdParam), TeamController.getTeamMembers);
router.post("/", authenticateToken, validate(addTeamMemberBody), TeamController.addTeamMember);
router.delete("/:id", authenticateToken, validateParams(idParamSchema), TeamController.removeTeamMember);

export const teamRoutes = router;
