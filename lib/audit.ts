import { prisma } from "@/lib/prisma";

interface CreateAuditLogParams {
  actorId: number;
  action: string;
  targetType: string;
  targetId?: number;
  details?: Record<string, unknown>;
}

export async function createAuditLog({
  actorId,
  action,
  targetType,
  targetId = 0,
  details = {},
}: CreateAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      adminId: actorId,
      action,
      targetType,
      targetId,
      details: JSON.stringify(details),
    },
  });
}
