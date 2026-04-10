import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.order.findMany({ select: { id: true, productName: true, createdAt: true } });
  console.log(orders);
}
main().finally(() => prisma.$disconnect());
