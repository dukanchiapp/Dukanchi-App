import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { pubClient } from "../../config/redis";

const ADMIN_STATS_KEY = 'admin:stats';

export class AuthService {
  static async signup(data: any) {
    const { name, phone, password, role, location } = data;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      throw new Error("This phone number already exists");
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: { name, phone, password: hashedPassword, role, location }
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });

    try { await pubClient.del(ADMIN_STATS_KEY); } catch { /* Redis unavailable — non-fatal */ }

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  static async login(data: any) {
    const { phone, password } = data;

    // Check registered User account FIRST — a phone that exists in the User table
    // always belongs to that user, even if it also appears in TeamMember.
    // Checking TeamMember first would hijack the user's identity.
    const user = await prisma.user.findUnique({ where: { phone } });

    if (user) {
      if (user.isBlocked) throw new Error("Your account has been blocked. Please contact support.");

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        // Phone exists as a User — don't fall through to TeamMember; just fail.
        throw new Error("Invalid credentials");
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, token };
    }

    // No User account found — try TeamMember login
    const teamMember = await prisma.teamMember.findUnique({
      where: { phone },
      include: { store: { include: { owner: true } } }
    });

    if (teamMember) {
      const validPassword = await bcrypt.compare(password, teamMember.passwordHash);
      if (!validPassword) throw new Error("Invalid credentials");

      const token = jwt.sign(
        { userId: teamMember.store.ownerId, role: teamMember.store.owner.role, teamMemberId: teamMember.id },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      const { password: _, ...userWithoutPassword } = teamMember.store.owner;
      return { user: userWithoutPassword, token, isTeamMember: true };
    }

    throw new Error("Invalid credentials");
  }
}
