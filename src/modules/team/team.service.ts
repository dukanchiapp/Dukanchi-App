import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import bcrypt from "bcrypt";

export class TeamService {
  static async getTeamMembers(storeId: string, userId: string, teamMemberId?: string) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== userId || teamMemberId) {
      throw new Error("Only the owner can manage the team");
    }

    return prisma.teamMember.findMany({
      where: { storeId },
      select: { id: true, phone: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async addTeamMember(data: any, userId: string, teamMemberId?: string) {
    const { phone, password, storeId, name } = data;
    
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== userId || teamMemberId) {
      throw new Error("Only the owner can add team members");
    }

    if (!phone || !password) throw new Error("Phone and password are required");
    if (password.length < 4) throw new Error("Password must be at least 4 characters");

    const memberCount = await prisma.teamMember.count({ where: { storeId } });
    if (memberCount >= 3) throw new Error("Maximum 3 team members allowed per store");

    const existing = await prisma.teamMember.findUnique({ where: { phone } });
    if (existing) throw new Error("A team member with this phone number already exists");

    const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    return prisma.teamMember.create({
      data: { phone, passwordHash: hashedPassword, storeId, name: name || 'Team Member', role: 'member' },
      select: { id: true, phone: true, name: true, role: true, createdAt: true }
    });
  }

  static async removeTeamMember(id: string, userId: string, teamMemberId?: string) {
    if (teamMemberId) throw new Error("Team members cannot remove other members");

    const member = await prisma.teamMember.findUnique({ where: { id }, include: { store: true } });
    if (!member) throw new Error("Team member not found");
    if (member.store.ownerId !== userId) throw new Error("Only the owner can remove team members");

    await prisma.teamMember.delete({ where: { id } });
    return { success: true };
  }
}
