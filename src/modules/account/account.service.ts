import { prisma } from "../../config/prisma";

const GRACE_DAYS = 30;

type DeletionRequestResult = {
  id: string;
  deletionRequestedAt: Date;
  deletedAt: Date;
};

type RestoreResult =
  | { id: string; restored: true }
  | { id: string; alreadyActive: true }
  | { id: string; expired: true };

export class AccountService {
  /**
   * Soft-delete a user account.
   * deletionRequestedAt = NOW() (when the user clicked delete)
   * deletedAt           = NOW() + GRACE_DAYS (when the account becomes inaccessible)
   * deletionReason      = optional, DB-capped at 500 chars (VARCHAR(500))
   * Does NOT clear sessions — the frontend handles logout flow after this call.
   */
  static async requestDeletion(userId: string, reason?: string): Promise<DeletionRequestResult> {
    const now = new Date();
    const deletedAt = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        deletionRequestedAt: now,
        deletedAt,
        deletionReason: reason ?? null,
      },
      select: { id: true, deletionRequestedAt: true, deletedAt: true },
    });

    // After update, deletionRequestedAt + deletedAt are non-null (we just set them).
    // Prisma still types them as nullable from the select; narrow at the boundary.
    if (!updated.deletionRequestedAt || !updated.deletedAt) {
      throw new Error("Soft-delete write did not persist timestamps");
    }
    return { id: updated.id, deletionRequestedAt: updated.deletionRequestedAt, deletedAt: updated.deletedAt };
  }

  /**
   * Restore a soft-deleted account if still within the grace period.
   * Returns a discriminated union: restored | alreadyActive | expired.
   * Caller (controller) maps these to HTTP status codes.
   */
  static async restore(userId: string): Promise<RestoreResult | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, deletionRequestedAt: true },
    });
    if (!user) return null;
    if (!user.deletionRequestedAt) return { id: user.id, alreadyActive: true };
    if (user.deletedAt && user.deletedAt.getTime() <= Date.now()) {
      return { id: user.id, expired: true };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null, deletionRequestedAt: null, deletionReason: null },
    });
    return { id: userId, restored: true };
  }
}
