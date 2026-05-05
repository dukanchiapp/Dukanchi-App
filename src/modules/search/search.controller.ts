import { Request, Response } from "express";
import { SearchService } from "./search.service";
import { logger } from "../../lib/logger";

export class SearchController {
  private static getAllowedRoles(userRole: string): string[] {
    if (userRole === 'customer') return ['retailer'];
    if (userRole === 'retailer') return ['retailer', 'supplier', 'manufacturer', 'brand'];
    if (['supplier', 'manufacturer', 'brand'].includes(userRole)) return ['retailer', 'supplier', 'manufacturer', 'brand'];
    if (userRole === 'admin') return ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];
    return [];
  }

  static async search(req: Request, res: Response) {
    try {
      const userRole = (req as any).user.role;
      const { q } = req.query;
      if (!q || String(q).trim().length < 2) return res.json({ products: [], stores: [] });

      const allowedRoles = SearchController.getAllowedRoles(userRole);
      const result = await SearchService.performStandardSearch(String(q).trim(), allowedRoles);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to perform search" });
    }
  }

  static async getSuggestions(req: Request, res: Response) {
    try {
      const { q } = req.query;
      if (!q || String(q).trim().length < 1) return res.json({ suggestions: [] });
      
      const suggestions = await SearchService.getSuggestions(String(q).trim());
      res.json({ suggestions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  }

  static async searchAi(req: Request, res: Response) {
    try {
      const { q } = req.query;
      if (!q || String(q).trim().length < 2) return res.json({ products: [], stores: [], query: '' });

      const userRole = (req as any).user.role;
      const allowedRoles = SearchController.getAllowedRoles(userRole);

      const result = await SearchService.performAISearch(String(q).trim(), allowedRoles);
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, "AI search error");
      res.status(500).json({ error: "Failed to perform search" });
    }
  }

  static async saveSearchHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { query } = req.body;
      const result = await SearchService.saveSearchHistory(userId, query);
      res.json(result);
    } catch (error: any) {
      if (error.message === "Query is required") return res.status(400).json({ error: "Query is required" });
      res.status(500).json({ error: "Failed to save search history" });
    }
  }

  static async clearSearchHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await SearchService.clearSearchHistory(userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to clear search history" });
    }
  }
}
