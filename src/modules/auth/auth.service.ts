import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";

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

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  static async login(data: any) {
    const { phone, password } = data;

    // Check Team Member login first
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

    // Normal User login path
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new Error("Invalid credentials");

    if (user.isBlocked) throw new Error("Your account has been blocked. Please contact support.");

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error("Invalid credentials");

    const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }
}
