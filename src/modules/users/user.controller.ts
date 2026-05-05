import { Request, Response } from "express";
import { UserService } from "./user.service";

export class UserController {
  static async getUserStore(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const store = await UserService.getUserStore(userId);
      res.json(store);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user store" });
    }
  }

  static async getUserProfile(req: Request, res: Response) {
    try {
      const user = await UserService.getUserProfile(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  }

  static async updateUserProfile(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const reqUser = (req as any).user;
      
      if (reqUser.userId !== id && reqUser.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized to update this user" });
      }

      const { name, phone, email } = req.body;
      const user = await UserService.updateUserProfile(id, { name, phone, email });
      res.json(user);
    } catch (error: any) {
      if (error.message.includes("phone number is already in use")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update user profile" });
    }
  }

  static async getFollowing(req: Request, res: Response) {
    try {
      const requesterId = (req as any).user.userId;
      if (req.params.id !== requesterId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const stores = await UserService.getFollowedStores(req.params.id);
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch followed stores" });
    }
  }

  static async getSaved(req: Request, res: Response) {
    try {
      const requesterId = (req as any).user.userId;
      const role = (req as any).user.role;
      if (req.params.id !== requesterId && role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const result = await UserService.getSavedItems(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved items" });
    }
  }

  static async getReviews(req: Request, res: Response) {
    try {
      const reviews = await UserService.getReviews(req.params.id);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  }

  static async getSearchHistory(req: Request, res: Response) {
    try {
      const requesterId = (req as any).user.userId;
      const role = (req as any).user.role;
      if (req.params.id !== requesterId && role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const history = await UserService.getSearchHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch search history" });
    }
  }

  static async getLocations(req: Request, res: Response) {
    try {
      const requesterId = (req as any).user.userId;
      const role = (req as any).user.role;
      if (req.params.id !== requesterId && role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const locations = await UserService.getLocations(req.params.id);
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved locations" });
    }
  }
}
