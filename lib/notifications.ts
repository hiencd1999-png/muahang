import { prisma } from "@/lib/prisma";

export async function createNotification(
  userId: number,
  type: "ORDER_CREATED" | "ORDER_COMPLETED" | "ORDER_CANCELED" | "DEPOSIT_SUCCESS" | "BALANCE_CHANGED" | "ADMIN_MESSAGE",
  title: string,
  message: string,
  link?: string
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link,
    },
  });
}

export async function getUnreadCount(userId: number) {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}
