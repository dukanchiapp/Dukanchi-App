import { Request, Response } from "express";
import { TeamService } from "./team.service";

export class TeamController {
  static async getTeamMembers(req: Request, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = (req as any).user.userId;
      const teamMemberId = (req as any).user.teamMemberId;

      const members = await TeamService.getTeamMembers(storeId, userId, teamMemberId);
      res.json(members);
    } catch (error: any) {
      if (error.message === "Only the owner can manage the team") return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  }

  static async addTeamMember(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const teamMemberId = (req as any).user.teamMemberId;

      const member = await TeamService.addTeamMember(req.body, userId, teamMemberId);
      res.json(member);
    } catch (error: any) {
      if (error.message === "Only the owner can add team members") return res.status(403).json({ error: error.message });
      if (error.message === "Phone and password are required") return res.status(400).json({ error: error.message });
      if (error.message === "Password must be at least 4 characters") return res.status(400).json({ error: error.message });
      if (error.message === "Maximum 3 team members allowed per store") return res.status(400).json({ error: error.message });
      if (error.message === "A team member with this phone number already exists" || error.code === 'P2002') {
        return res.status(400).json({ error: "Phone number already in use" });
      }
      res.status(500).json({ error: "Failed to add team member" });
    }
  }

  static async removeTeamMember(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const teamMemberId = (req as any).user.teamMemberId;

      const result = await TeamService.removeTeamMember(req.params.id, userId, teamMemberId);
      res.json(result);
    } catch (error: any) {
      if (error.message === "Team members cannot remove other members") return res.status(403).json({ error: error.message });
      if (error.message === "Team member not found") return res.status(404).json({ error: error.message });
      if (error.message === "Only the owner can remove team members") return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to remove team member" });
    }
  }
}
