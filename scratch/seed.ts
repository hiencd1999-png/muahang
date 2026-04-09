import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.systemAccount.upsert({ where: { id: "SYSTEM_REVENUE" }, update: {}, create: { id: "SYSTEM_REVENUE", name: "Doanh Thu Hệ Thống" } });
  await prisma.systemAccount.upsert({ where: { id: "SYSTEM_ESCROW" }, update: {}, create: { id: "SYSTEM_ESCROW", name: "Quỹ Trung Gian" } });
  await prisma.systemAccount.upsert({ where: { id: "ADMIN_LIQUIDITY_POOL" }, update: {}, create: { id: "ADMIN_LIQUIDITY_POOL", name: "Kho Thanh Khoản SPADMIN" } });
  console.log("Seeded System Accounts");
}

main().then(() => prisma.$disconnect());
