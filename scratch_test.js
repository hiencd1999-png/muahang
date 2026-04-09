const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const configs = await prisma.adminBankConfig.findMany();
    console.log(configs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
