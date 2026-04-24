import { Request, Response } from "express";
import { StoreService } from "./store.service";
import { prisma } from "../../config/prisma";

export class StoreController {
  static async createStore(req: Request, res: Response) {
    try {
      const currentUser = await prisma.user.findUnique({ 
        where: { id: (req as any).user.userId }, 
        select: { role: true, kycStatus: true } 
      });
      
      if (currentUser && currentUser.role !== "customer" && currentUser.role !== "admin" && currentUser.kycStatus !== "approved") {
        return res.status(403).json({ error: "KYC verification required", kycStatus: currentUser.kycStatus });
      }

      const { ownerId, phone } = req.body;
      
      if (phone) {
        const actualOwnerId = ownerId || (req as any).user.userId;
        const owner = await prisma.user.findUnique({ where: { id: actualOwnerId } });
        const normalizedPhone = phone.replace(/[\s\-()\+]/g, '');
        const ownerPhone = owner?.phone?.replace(/[\s\-()\+]/g, '') || '';
        
        if (normalizedPhone !== ownerPhone && normalizedPhone !== ownerPhone.replace(/^91/, '')) {
          const existingStore = await prisma.store.findFirst({ where: { phone } });
          if (existingStore) {
            return res.status(400).json({ error: "This phone number is already used by another store" });
          }
        }
      }

      const storeData = { ...req.body, ownerId: ownerId || (req as any).user.userId };
      const store = await StoreService.createStore(storeData);
      res.json(store);
    } catch (error) {
      console.error("Failed to create store:", error);
      res.status(500).json({ error: "Failed to create store" });
    }
  }

  static async updateStore(req: Request, res: Response) {
    try {
      const existingStore = await prisma.store.findUnique({ where: { id: req.params.id } });
      if (!existingStore) return res.status(404).json({ error: "Store not found" });

      if (req.body.phone && req.body.phone !== existingStore.phone) {
        const owner = await prisma.user.findUnique({ where: { id: existingStore.ownerId } });
        const normalizedPhone = req.body.phone.replace(/[\s\-()\+]/g, '');
        const ownerPhone = owner?.phone?.replace(/[\s\-()\+]/g, '') || '';
        if (normalizedPhone !== ownerPhone && normalizedPhone !== ownerPhone.replace(/^91/, '')) {
          const otherStore = await prisma.store.findFirst({ where: { phone: req.body.phone, NOT: { id: req.params.id } } });
          if (otherStore) {
            return res.status(400).json({ error: "This phone number is already used by another store" });
          }
        }
      }

      const store = await StoreService.updateStore(req.params.id, req.body);
      res.json(store);
    } catch (error) {
      console.error("Failed to update store:", error);
      res.status(500).json({ error: "Failed to update store" });
    }
  }

  static async getStores(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20", category } = req.query as any;
      const result = await StoreService.getStores(parseInt(page), parseInt(limit), category);
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  }

  static async getPincodeInfo(req: Request, res: Response) {
    try {
      const code = req.params.code;
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Invalid pincode" });
      const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
      const data = await response.json();
      if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        const districts = [...new Set(data[0].PostOffice.map((p: any) => p.District))];
        const states = [...new Set(data[0].PostOffice.map((p: any) => p.State))];
        res.json({ 
          city: po.District, 
          state: po.State,
          allCities: districts,
          allStates: states,
          postOffices: data[0].PostOffice.map((p: any) => p.Name)
        });
      } else {
        res.status(404).json({ error: "Pincode not found" });
      }
    } catch (error) {
      console.error("Pincode lookup error:", error);
      res.status(500).json({ error: "Failed to look up pincode" });
    }
  }

  static async getStoreById(req: Request, res: Response) {
    try {
      const { userId } = req.query;
      const store = await StoreService.getStoreById(req.params.id, userId as string);
      if (!store || (store.owner as any)?.isBlocked) return res.status(404).json({ error: "Store not found" });
      res.set('Cache-Control', 'public, max-age=30');
      res.json(store);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch store" });
    }
  }

  static async toggleFollow(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      const storeId = req.params.id;
      const result = await StoreService.toggleFollow(userId, storeId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle follow" });
    }
  }

  static async getStorePosts(req: Request, res: Response) {
    try {
      const { page = "1", limit = "30" } = req.query as any;
      const result = await StoreService.getStorePosts(req.params.id, parseInt(page), parseInt(limit));
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  }

  static async createProduct(req: Request, res: Response) {
    try {
      const product = await StoreService.createProduct(req.body);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to create product" });
    }
  }

  static async getProducts(req: Request, res: Response) {
    try {
      const { search, category, storeId } = req.query;
      const products = await StoreService.getProducts(search as string, category as string, storeId as string);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  }
}
