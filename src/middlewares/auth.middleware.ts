import express from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { pubClient } from "../config/redis";

const JWT_SECRET = env.JWT_SECRET;

// Redis-backed cache for blocked user status (TTL 60s)
const BLOCKED_TTL = 60;
const isUserBlocked = async (userId: string): Promise<boolean> => {
  const key = `blocked:${userId}`;
  try {
    const cached = await pubClient.get(key);
    if (cached !== null) return cached === '1';
  } catch {}
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { isBlocked: true } });
  const blocked = row?.isBlocked ?? false;
  try { await pubClient.set(key, blocked ? '1' : '0', { EX: BLOCKED_TTL }); } catch {}
  return blocked;
};

// Redis-backed cache for team member existence (TTL 120s)
const TEAM_MEMBER_TTL = 120;
const teamMemberExists = async (teamMemberId: string): Promise<boolean> => {
  const key = `team:${teamMemberId}`;
  try {
    const cached = await pubClient.get(key);
    if (cached !== null) return cached === '1';
  } catch {}
  const member = await prisma.teamMember.findUnique({ where: { id: teamMemberId }, select: { id: true } });
  const exists = !!member;
  try { await pubClient.set(key, exists ? '1' : '0', { EX: TEAM_MEMBER_TTL }); } catch {}
  return exists;
};

export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Read token from cookie, fallback to Authorization header if needed (for backward compatibility if any)
  const token = req.cookies?.dk_token || (req.headers['authorization']?.split(' ')[1]);
  
  console.log(`[AUTH] Path: ${req.path}, Cookies:`, req.cookies, `AuthHeader:`, req.headers['authorization'], `TokenFound:`, !!token);

  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.userId) return res.status(403).json({ error: "Invalid token" });

    // Check team member revocation via Redis cache
    (async () => {
      if (decoded.teamMemberId) {
        if (!(await teamMemberExists(decoded.teamMemberId))) return res.status(403).json({ error: "Access revoked" });
      }

      // Blocked check via Redis cache
      if (await isUserBlocked(decoded.userId)) return res.status(403).json({ error: "Account blocked" });

      (req as any).user = decoded;
      next();
    })();
  } catch (error) {
    res.status(403).json({ error: "Invalid token" });
  }
};

export const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

export const canChat = (role1: string, role2: string) => {
  if (role1 === 'admin' || role2 === 'admin') return true;
  if (role1 === 'customer' && role2 === 'retailer') return true;
  if (role1 === 'retailer' && role2 === 'customer') return true;
  if (['supplier', 'manufacturer', 'brand'].includes(role1) && role2 === 'retailer') return true;
  if (['supplier', 'manufacturer', 'brand'].includes(role2) && role1 === 'retailer') return true;
  return false;
};
