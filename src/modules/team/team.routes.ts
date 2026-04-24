import { Router } from "express";
import { TeamController } from "./team.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";

const router = Router();

// /api/team
router.get("/:storeId", authenticateToken, TeamController.getTeamMembers);
router.post("/", authenticateToken, TeamController.addTeamMember);
router.delete("/:id", authenticateToken, TeamController.removeTeamMember);

export const teamRoutes = router;
