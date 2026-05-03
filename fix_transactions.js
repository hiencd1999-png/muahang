const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.transaction.updateMany({
    where: {
      amount: 200,
      note: {
        contains: '[TikTok]'
      }
    },
    data: {
      amount: -200
    }
  });
  console.log(`Updated ${result.count} transactions.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
