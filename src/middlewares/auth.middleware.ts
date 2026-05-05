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
  } catch { /* Redis unavailable — fall through to DB */ }
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { isBlocked: true } });
  const blocked = row?.isBlocked ?? false;
  try { await pubClient.set(key, blocked ? '1' : '0', { EX: BLOCKED_TTL }); } catch { /* Redis unavailable — non-fatal */ }
  return blocked;
};

// Redis-backed cache for team member existence (TTL 120s)
const TEAM_MEMBER_TTL = 120;
const teamMemberExists = async (teamMemberId: string): Promise<boolean> => {
  const key = `team:${teamMemberId}`;
  try {
    const cached = await pubClient.get(key);
    if (cached !== null) return cached === '1';
  } catch { /* Redis unavailable — fall through to DB */ }
  const member = await prisma.teamMember.findUnique({ where: { id: teamMemberId }, select: { id: true } });
  const exists = !!member;
  try { await pubClient.set(key, exists ? '1' : '0', { EX: TEAM_MEMBER_TTL }); } catch { /* Redis unavailable — non-fatal */ }
  return exists;
};

// Shared token-verification logic
const verifyAndAttach = async (
  token: string | undefined,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (!token) return res.status(401).json({ error: "Access denied" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded?.userId) return res.status(403).json({ error: "Invalid token" });
    if (decoded.teamMemberId && !(await teamMemberExists(decoded.teamMemberId)))
      return res.status(403).json({ error: "Access revoked" });
    if (await isUserBlocked(decoded.userId))
      return res.status(403).json({ error: "Account blocked" });
    (req as any).user = decoded;
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
};

// Main-app routes — reads dk_token only; admin sessions (dk_admin_token) are invisible here
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.dk_token || req.headers['authorization']?.split(' ')[1];
  return verifyAndAttach(token, req, res, next);
};

// Admin-panel routes — reads dk_admin_token; falls back to Authorization header
export const authenticateAdminToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.dk_admin_token || req.headers['authorization']?.split(' ')[1];
  return verifyAndAttach(token, req, res, next);
};

// Shared endpoints (e.g. /api/me) that both apps call — accepts either cookie
export const authenticateAny = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.dk_token || req.cookies?.dk_admin_token || req.headers['authorization']?.split(' ')[1];
  return verifyAndAttach(token, req, res, next);
};


export const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

const B2B_ROLES = new Set(['retailer', 'supplier', 'brand', 'manufacturer']);

export const canChat = (role1: string, role2: string): boolean => {
  if (role1 === 'customer') return role2 === 'retailer';
  if (role2 === 'customer') return role1 === 'retailer';
  return B2B_ROLES.has(role1) && B2B_ROLES.has(role2);
};
