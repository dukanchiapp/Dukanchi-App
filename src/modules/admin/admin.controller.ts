import { Request, Response } from "express";
import { AdminService } from "./admin.service";
import { getUploadedFileUrl } from "../../middlewares/upload.middleware";

export class AdminController {
  static async getStats(_req: Request, res: Response) {
    try {
      const stats = await AdminService.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  }

  static async getUsers(req: Request, res: Response) {
    try {
      const { search, role, page = "1", limit = "20" } = req.query;
      const result = await AdminService.getUsers({ search, role, page: parseInt(page as string), limit: parseInt(limit as string) });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { userId, newPassword } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const result = await AdminService.resetPassword(userId, newPassword);
      res.json(result);
    } catch (error: any) {
      if (error.message === "Password must be at least 6 characters") return res.status(400).json({ error: error.message });
      res.status(500).json({ error: "Failed to reset password" });
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const { role, isBlocked } = req.body;
      const user = await AdminService.updateUser(req.params.id, role, isBlocked);
      res.json(user);
    } catch (error: any) {
      if (error.message === "This admin account cannot be modified") return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to update user" });
    }
  }

  static async bulkUpdateUsers(req: Request, res: Response) {
    try {
      const { userIds, isBlocked } = req.body;
      if (!Array.isArray(userIds)) return res.status(400).json({ error: "userIds must be an array" });
      const currentUserId = (req as any).user.userId;
      const result = await AdminService.bulkUpdateUsers(userIds, isBlocked, currentUserId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to perform bulk update" });
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteUser(req.params.id);
      res.json(result);
    } catch (error: any) {
      if (error.message === "This admin account cannot be deleted") return res.status(403).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete user and its dependencies" });
    }
  }

  static async getStores(req: Request, res: Response) {
    try {
      const { search, page = "1", limit = "20" } = req.query;
      const result = await AdminService.getStores({ search, page: parseInt(page as string), limit: parseInt(limit as string) });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  }

  static async deleteStore(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteStore(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete store and its dependencies" });
    }
  }

  static async getStoreMembersList(req: Request, res: Response) {
    try {
      const stores = await AdminService.getStoreMembers(req.query.search as string);
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch store members" });
    }
  }

  static async getStoreMemberDetails(req: Request, res: Response) {
    try {
      const store = await AdminService.getStoreMemberDetails(req.params.storeId);
      res.json(store);
    } catch (error: any) {
      if (error.message === "Store not found") return res.status(404).json({ error: "Store not found" });
      res.status(500).json({ error: "Failed to fetch store details" });
    }
  }

  static async deleteTeamMember(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteTeamMember(req.params.memberId);
      res.json(result);
    } catch (error: any) {
      if (error.message === "Team member not found") return res.status(404).json({ error: "Team member not found" });
      res.status(500).json({ error: "Failed to delete team member" });
    }
  }

  static async exportStores(_req: Request, res: Response) {
    try {
      const buf = await AdminService.exportStores();
      const filename = `stores-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buf);
    } catch (error) {
      res.status(500).json({ error: "Failed to export stores" });
    }
  }

  static async getReports(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20" } = req.query;
      const result = await AdminService.getReports(parseInt(page as string), parseInt(limit as string));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  }

  static async deleteReport(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteReport(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  }

  static async getChats(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20" } = req.query;
      const result = await AdminService.getChats(parseInt(page as string), parseInt(limit as string));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin chats" });
    }
  }

  static async getChatHistory(req: Request, res: Response) {
    try {
      const { u1, u2 } = req.query;
      const result = await AdminService.getChatHistory(u1 as string, u2 as string);
      res.json(result);
    } catch (error: any) {
      if (error.message === "Both user IDs are required") return res.status(400).json({ error: "Both user IDs are required" });
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  }

  static async getSettings(_req: Request, res: Response) {
    try {
      const settings = await AdminService.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  }

  static async updateSettings(req: Request, res: Response) {
    try {
      const settings = await AdminService.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  }

  static async uploadSettingsImage(req: Request, res: Response) {
    try {
      const file = req.file as any;
      if (!file) return res.status(400).json({ error: "No file uploaded" });
      const imageUrl = getUploadedFileUrl(file);
      res.json({ url: imageUrl });
    } catch (error) {
      res.status(500).json({ error: "Failed to upload image" });
    }
  }

  static async getComplaints(req: Request, res: Response) {
    try {
      const { status, page = "1", limit = "20" } = req.query;
      const result = await AdminService.getComplaints(status as string, parseInt(page as string), parseInt(limit as string));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch complaints" });
    }
  }

  static async updateComplaint(req: Request, res: Response) {
    try {
      const { status, adminNotes } = req.body;
      const result = await AdminService.updateComplaint(req.params.id, status, adminNotes);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update complaint" });
    }
  }

  static async deleteComplaint(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteComplaint(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete complaint" });
    }
  }

  static async getPosts(req: Request, res: Response) {
    try {
      const { search, page = "1", limit = "20" } = req.query;
      const result = await AdminService.getPosts(search as string, parseInt(page as string), parseInt(limit as string));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  }

  static async deletePost(req: Request, res: Response) {
    try {
      const result = await AdminService.deletePost(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete post" });
    }
  }

  static async getKycList(req: Request, res: Response) {
    try {
      const { status, page = "1", limit = "20" } = req.query;
      const result = await AdminService.getKycList(status as string, parseInt(page as string), parseInt(limit as string));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KYC list" });
    }
  }

  static async updateKycStatus(req: Request, res: Response) {
    try {
      const { status, notes } = req.body;
      const result = await AdminService.updateKycStatus(req.params.id, status, notes);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update KYC status" });
    }
  }
}
