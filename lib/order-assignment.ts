import { prisma } from "@/lib/prisma";

export const ORDER_ASSIGNMENT_TIMEOUT_MINUTES = 60;

export function getProcessingTimeoutCutoff(now = new Date()) {
  return new Date(now.getTime() - ORDER_ASSIGNMENT_TIMEOUT_MINUTES * 60 * 1000);
}

export async function releaseExpiredProcessingOrders() {
  const cutoff = getProcessingTimeoutCutoff();

  const result = await prisma.order.updateMany({
    where: {
      status: "PROCESSING",
      approvedByAdminId: { not: null },
      processingStartedAt: { lte: cutoff },
    },
    data: {
      status: "PENDING",
      approvedByAdminId: null,
      processingStartedAt: null,
      spcCookie: "",
      trackingNo: "",
    },
  });

  return result.count;
}