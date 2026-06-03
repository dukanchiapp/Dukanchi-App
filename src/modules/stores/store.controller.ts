import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { StoreService } from "./store.service";
import { BulkImportService } from "./bulkImport.service";
import { prisma } from "../../config/prisma";
import { logger } from "../../lib/logger";
import { pubClient } from "../../config/redis";

export class StoreController {
  static async createStore(req: Request, res: Response) {
    try {
      const jwtUser = (req as any).user;

      // Admin accounts cannot own stores — they manage the platform, not storefronts
      if (jwtUser.role === 'admin' && !req.body.ownerId) {
        return res.status(403).json({ error: "Admin accounts cannot create stores" });
      }

      // ownerId is always the JWT user; body ownerId only accepted when caller is admin
      // (so admin can create a store on behalf of an approved user via the admin panel)
      const ownerId = jwtUser.role === 'admin' && req.body.ownerId
        ? req.body.ownerId
        : jwtUser.userId;

      const currentUser = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { role: true, kycStatus: true }
      });

      // Block if target user is also an admin
      if (currentUser?.role === 'admin') {
        return res.status(403).json({ error: "Admin accounts cannot own stores" });
      }

      if (currentUser && currentUser.role !== "customer" && currentUser.kycStatus !== "approved") {
        return res.status(403).json({ error: "KYC verification required", kycStatus: currentUser.kycStatus });
      }

      const { phone } = req.body;

      if (phone) {
        const owner = await prisma.user.findUnique({ where: { id: ownerId } });
        const normalizedPhone = phone.replace(/[\s\-()\+]/g, '');
        const ownerPhone = owner?.phone?.replace(/[\s\-()\+]/g, '') || '';

        if (normalizedPhone !== ownerPhone && normalizedPhone !== ownerPhone.replace(/^91/, '')) {
          const existingStore = await prisma.store.findFirst({ where: { phone } });
          if (existingStore) {
            return res.status(400).json({ error: "This phone number is already used by another store" });
          }
        }
      }

      const storeData = { ...req.body, ownerId };
      const store = await StoreService.createStore(storeData);
      return res.json(store);
    } catch (error) {
      logger.error({ err: error }, "Failed to create store");
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to create store" });
    }
  }

  static async updateStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const existingStore = await prisma.store.findUnique({ where: { id: req.params.id } });
      if (!existingStore) return res.status(404).json({ error: "Store not found" });
      if (existingStore.ownerId !== userId) return res.status(403).json({ error: "Not your store" });

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
      return res.json(store);
    } catch (error) {
      logger.error({ err: error }, "Failed to update store");
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to update store" });
    }
  }

  static async getStores(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20", category, excludeOwnerId } = req.query as any;
      const viewerRole = (req as any).user.role;
      const result = await StoreService.getStores(parseInt(page), parseInt(limit), viewerRole, category, excludeOwnerId);
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Failed to fetch stores" });
    }
  }

  static async getCategories(_req: Request, res: Response) {
    try {
      const stores = await prisma.store.findMany({
        where: { category: { not: '' } },
        select: { category: true },
        distinct: ['category'],
      });
      const dbCategories = stores.map(s => s.category).filter(Boolean) as string[];
      const defaultCategories = ['Clothing', 'Electronics', 'Jewelry', 'Cosmetics', 'Footwear', 'Groceries', 'Furniture'];
      const uniqueCategories = Array.from(new Set([...defaultCategories, ...dbCategories]));
      
      return res.json(uniqueCategories);
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch categories");
      return res.status(500).json({ error: "Failed to fetch categories" });
    }
  }

  static async getPincodeInfo(req: Request, res: Response) {
    try {
      const code = req.params.code;
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Invalid pincode" });
      type PostOffice = { Name: string; District: string; State: string };
      type PincodeResp = Array<{ Status: string; PostOffice: PostOffice[] | null }>;
      // 5s timeout — Subtask 3.5. External public API (api.postalpincode.in)
      // has no SLA; fail fast so signup pincode-autofill doesn't block on it.
      const response = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
        signal: AbortSignal.timeout(5_000),
      });
      const data = (await response.json()) as PincodeResp;
      if (data?.[0]?.Status === 'Success' && (data[0].PostOffice?.length ?? 0) > 0) {
        const postOffices = data[0].PostOffice ?? [];
        const po = postOffices[0];
        const districts = [...new Set(postOffices.map((p) => p.District))];
        const states = [...new Set(postOffices.map((p) => p.State))];
        return res.json({
          city: po.District,
          state: po.State,
          allCities: districts,
          allStates: states,
          postOffices: postOffices.map((p) => p.Name)
        });
      } else {
        return res.status(404).json({ error: "Pincode not found" });
      }
    } catch (error) {
      logger.error({ err: error }, "Pincode lookup error");
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to look up pincode" });
    }
  }

  /* ── Session 128.9 — Reverse geocode (lat/lng → pincode + city + state) ──
     Used by the edit-profile GPS-pin button: user taps "Save my location"
     → we reverse-geocode via OpenStreetMap Nominatim (free, no key) to extract
     pincode, then optionally enrich city/state via the existing India Post
     lookup (authoritative for IN addresses). Redis-cached for 7 days keyed on
     lat/lng rounded to 3 decimals (~110m), so neighbouring users in the same
     building/lane share a cache hit. Sentry-only on errors; returns the
     partial data we DID get (rather than 500) so the caller can still set
     what it has and fall back to manual entry for the rest.

     Auth required — prevents anonymous abuse of the Nominatim quota
     (1 req/s/IP, but Dukanchi's egress is one IP so we must conserve). */
  static async getReverseGeocode(req: Request, res: Response) {
    try {
      const lat = parseFloat(String(req.query.lat));
      const lng = parseFloat(String(req.query.lng));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Invalid lat/lng" });
      }

      // ~110m precision cache key — collapses near-identical pins into 1 hit
      const cacheKey = `geocode:rev:${lat.toFixed(3)}:${lng.toFixed(3)}`;
      try {
        const cached = await pubClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached as string));
      } catch { /* Redis down — fall through to live lookup */ }

      type NominatimAddress = {
        postcode?: string;
        suburb?: string; neighbourhood?: string; city_district?: string;
        city?: string; town?: string; village?: string;
        state?: string; country?: string;
      };

      // 1) Nominatim reverse geocode — User-Agent required by their TOS.
      const nominRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'Dukanchi/1.0 (contact@dukanchi.com)' },
          signal: AbortSignal.timeout(5_000),
        }
      );
      const nominData = (await nominRes.json().catch(() => null)) as { address?: NominatimAddress } | null;
      const a = nominData?.address ?? {};

      const pincode = a.postcode && /^\d{6}$/.test(a.postcode) ? a.postcode : null;
      const nominCity = a.city || a.town || a.village || a.city_district || a.suburb || null;
      const nominState = a.state || null;
      const suburb = a.suburb || a.neighbourhood || a.city_district || null;

      let city: string | null = nominCity;
      let state: string | null = nominState;
      let allCities: string[] = [];
      let allStates: string[] = [];

      // 2) If we got a valid IN pincode, enrich via the India Post API which
      //    is more authoritative for Indian addresses (returns district + state).
      if (pincode) {
        try {
          const ipRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
            signal: AbortSignal.timeout(5_000),
          });
          const ipData = (await ipRes.json()) as Array<{ Status: string; PostOffice: Array<{ Name: string; District: string; State: string }> | null }>;
          if (ipData?.[0]?.Status === 'Success' && (ipData[0].PostOffice?.length ?? 0) > 0) {
            const postOffices = ipData[0].PostOffice ?? [];
            city = postOffices[0].District;
            state = postOffices[0].State;
            allCities = [...new Set(postOffices.map((p) => p.District))];
            allStates = [...new Set(postOffices.map((p) => p.State))];
          }
        } catch {
          // India Post failed — keep Nominatim values, fall through.
        }
      }

      const result = { pincode, city, state, suburb, allCities, allStates, country: a.country ?? null };

      // 7-day cache — addresses don't change on us.
      try { await pubClient.set(cacheKey, JSON.stringify(result), { EX: 7 * 24 * 60 * 60 }); }
      catch { /* Redis down — don't fail the request */ }

      return res.json(result);
    } catch (error) {
      logger.error({ err: error, lat: req.query.lat, lng: req.query.lng }, "reverse geocode error");
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId, lat: req.query.lat, lng: req.query.lng },
      });
      // Return empty payload (200) — caller can fall back to manual entry without erroring.
      return res.json({ pincode: null, city: null, state: null, suburb: null, allCities: [], allStates: [], country: null });
    }
  }

  static async getStoreById(req: Request, res: Response) {
    try {
      const { userId } = req.query;
      const store = await StoreService.getStoreById(req.params.id, userId as string);
      if (!store || (store.owner as any)?.isBlocked) return res.status(404).json({ error: "Store not found" });

      // Customer can only view retailer stores — return 404 (not 403) to avoid leaking existence
      const viewerRole = (req as any).user?.role;
      if (viewerRole === 'customer' && (store.owner as any)?.role !== 'retailer') {
        return res.status(404).json({ error: "Store not found" });
      }

      res.set('Cache-Control', 'public, max-age=30');
      return res.json(store);
    } catch (error) {
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "store.getStoreById failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to fetch store" });
    }
  }

  static async toggleFollow(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId; // Always use JWT identity, never trust body
      const storeId = req.params.id;
      const result = await StoreService.toggleFollow(userId, storeId);
      return res.json(result);
    } catch (error: any) {
      if (error.message === 'Store not found') return res.status(404).json({ error: 'Store not found' });
      return res.status(500).json({ error: error.message || 'Failed to toggle follow' });
    }
  }

  static async getStorePosts(req: Request, res: Response) {
    try {
      const { page = "1", limit = "30" } = req.query as any;
      const viewerRole = (req as any).user.role;
      const result = await StoreService.getStorePosts(req.params.id, parseInt(page), parseInt(limit), viewerRole);
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Failed to fetch posts" });
    }
  }

  static async createProduct(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { storeId } = req.body;

      // Verify the caller owns this store
      if (storeId) {
        const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
        if (!store) return res.status(404).json({ error: "Store not found" });
        if (store.ownerId !== userId) return res.status(403).json({ error: "Not your store" });
      }

      const product = await StoreService.createProduct(req.body);
      return res.json(product);
    } catch (error) {
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "store.createProduct failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to create product" });
    }
  }

  static async getProducts(req: Request, res: Response) {
    try {
      const { search, category, storeId } = req.query;
      const products = await StoreService.getProducts(search as string, category as string, storeId as string);
      return res.json(products);
    } catch (error) {
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "store.getProducts failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to fetch products" });
    }
  }

  static async bulkImport(req: Request, res: Response) {
    const { storeId } = req.params;
    const userId = (req as any).user.userId;

    try {
      if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

      // Verify ownership
      const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
      if (!store) return res.status(404).json({ success: false, error: "Store not found" });
      if (store.ownerId !== userId) return res.status(403).json({ success: false, error: "Not your store" });

      // Rate limit
      await BulkImportService.checkRateLimit(storeId);

      // Parse file (async since Day 6 Phase 2 — exceljs is promise-based)
      const { headers, rows } = await BulkImportService.parseExcelFile(req.file.buffer);

      // AI column mapping
      const mapping = await BulkImportService.mapColumnsWithAI(headers, rows);

      // Import
      const result = await BulkImportService.importProducts(storeId, rows, mapping);

      logger.info({ storeId, userId, imported: result.imported, skipped: result.skipped }, '[BulkImport] Import completed');

      return res.json({ success: true, imported: result.imported, skipped: result.skipped, mappingUsed: mapping, errors: result.errors });
    } catch (err: any) {
      // Handle multer file filter errors
      if (err.message?.includes('Only .xlsx')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      logger.error({ err, storeId }, '[BulkImport] Import failed');
      return res.status(400).json({ success: false, error: err.message || 'Import failed' });
    }
  }
}
