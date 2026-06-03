import { Router } from "express";
import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import { logger } from "../../lib/logger";

export const seoRoutes = Router();

seoRoutes.get('/', async (_req, res): Promise<any> => {
  try {
    const CACHE_KEY = "sitemap_xml";
    const cached = await pubClient.get(CACHE_KEY);
    
    if (cached) {
      res.header("Content-Type", "application/xml");
      return res.send(cached);
    }

    const stores = await prisma.store.findMany({
      select: {
        id: true,
        createdAt: true,
      }
    });

    const products = await prisma.product.findMany({
        select: {
            id: true,
            createdAt: true,
        }
    });

    const baseUrl = "https://dukanchi.com";
    
    const staticUrls = [
      { loc: "/", priority: "1.0", freq: "weekly" },
      { loc: "/landing", priority: "0.9", freq: "weekly" },
      { loc: "/signup", priority: "0.8", freq: "monthly" },
      { loc: "/login", priority: "0.6", freq: "monthly" },
      { loc: "/search", priority: "0.7", freq: "weekly" },
      { loc: "/map", priority: "0.7", freq: "weekly" },
      { loc: "/legal/privacy", priority: "0.4", freq: "yearly" },
      { loc: "/legal/terms", priority: "0.4", freq: "yearly" },
      { loc: "/legal/account-deletion", priority: "0.3", freq: "yearly" },
      { loc: "/legal/grievance", priority: "0.3", freq: "yearly" },
      { loc: "/legal/cookies", priority: "0.3", freq: "yearly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Add static URLs
    for (const url of staticUrls) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${url.loc}</loc>\n`;
      xml += `    <changefreq>${url.freq}</changefreq>\n`;
      xml += `    <priority>${url.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Add Store URLs
    for (const store of stores) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/store/${store.id}</loc>\n`;
      xml += `    <lastmod>${store.createdAt.toISOString().split("T")[0]}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    }

    // Add Product URLs
    for (const product of products) {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/product/${product.id}</loc>\n`;
        xml += `    <lastmod>${product.createdAt.toISOString().split("T")[0]}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    // Cache for 1 hour to prevent DB hammering by crawlers
    await pubClient.setEx(CACHE_KEY, 3600, xml);

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    logger.error({ error }, "Error generating dynamic sitemap");
    res.status(500).send("Error generating sitemap");
  }
});
