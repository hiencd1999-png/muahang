const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.transaction.updateMany({
    where: {
      type: 'ORDER_DEBIT',
      note: { startsWith: '[TikTok]' }
    },
    data: {
      type: 'TIKTOK_SYNC_FEE'
    }
  });
  console.log(`Updated ${result.count} transactions.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
