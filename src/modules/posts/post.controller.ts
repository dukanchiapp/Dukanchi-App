import { Request, Response } from "express";
import { PostService } from "./post.service";
import { pubClient } from "../../config/redis";
import { logger } from "../../lib/logger";
import { prisma } from "../../config/prisma";

export class PostController {
  static async createPost(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { storeId } = req.body;
      if (storeId) {
        const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
        if (!store) return res.status(404).json({ error: "Store not found" });
        if (store.ownerId !== userId) return res.status(403).json({ error: "Not your store" });
      }
      const post = await PostService.createPost(req.body);
      return res.json(post);
    } catch (error) {
      logger.error({ err: error }, "Failed to create post");
      return res.status(500).json({ error: "Failed to create post" });
    }
  }

  static async getFeed(req: Request, res: Response) {
    try {
      const userRole = (req as any).user.role;
      const userId = (req as any).user.userId;
      const { feedType, locationRange, lat, lng } = req.query;

      const page = parseInt(String(req.query.page || '1'));
      const limit = Math.min(parseInt(String(req.query.limit || '20')), 50);

      // Only cache the plain global feed — following/location feeds are user-specific
      // Cache key includes userId: feed contains per-user liked state and isOwnPost flags
      const isCacheable = !feedType && (!locationRange || locationRange === 'all');
      const cacheKey = `feed:${userId}:p${page}:l${limit}`;

      if (isCacheable) {
        try {
          const cached = await pubClient.get(cacheKey);
          if (cached) return res.json(JSON.parse(cached as string));
        } catch { /* Redis unavailable — fall through */ }
      }

      const result = await PostService.getFeed(userId, userRole, {
        feedType, locationRange, lat, lng, page, limit
      });

      if (isCacheable) {
        pubClient.set(cacheKey, JSON.stringify(result), { EX: 30 }).catch(() => {});
      }

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch feed" });
    }
  }

  static async getInteractions(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const interactions = await PostService.getInteractions(userId);
      return res.json(interactions);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch interactions" });
    }
  }

  static async toggleLike(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await PostService.toggleLike(userId, req.params.id);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: "Failed to toggle like" });
    }
  }

  static async toggleSave(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await PostService.toggleSave(userId, req.params.id);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: "Failed to toggle save" });
    }
  }

  static async togglePin(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await PostService.togglePin(req.params.id, userId);
      return res.json(result);
    } catch (error: any) {
      if (error.message === "Post not found") return res.status(404).json({ error: error.message });
      if (error.message === "Unauthorized") return res.status(403).json({ error: "Not your post" });
      if (error.message === "Maximum 3 pinned posts allowed") return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: "Failed to toggle pin" });
    }
  }

  static async updatePost(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await PostService.updatePost(req.params.id, userId, req.body);
      return res.json(result);
    } catch (error: any) {
      if (error.message === "Not found") return res.status(404).json({ error: "Not found" });
      if (error.message === "Unauthorized") return res.status(403).json({ error: "Unauthorized" });
      return res.status(500).json({ error: "Failed to update post" });
    }
  }

  static async deletePost(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await PostService.deletePost(req.params.id, userId);
      return res.json(result);
    } catch (error: any) {
      if (error.message === "Not found") return res.status(404).json({ error: "Not found" });
      if (error.message === "Unauthorized") return res.status(403).json({ error: "Unauthorized" });
      return res.status(500).json({ error: "Failed" });
    }
  }

  static async deleteAllStorePosts(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await PostService.deleteAllStorePosts(req.params.storeId, userId);
      return res.json(result);
    } catch (error: any) {
      if (error.message === "Unauthorized") return res.status(403).json({ error: "Unauthorized" });
      return res.status(500).json({ error: "Failed" });
    }
  }
}
