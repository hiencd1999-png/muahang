import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true, telegramId: true } });
  console.log(users);
  
  const banks = await prisma.bankDeposit.findMany({ select: { id: true, userId: true, adminId: true, amount: true, status: true }, take: 5, orderBy: { createdAt: 'desc' }});
  console.log(banks);
}
main().finally(() => prisma.$disconnect());
