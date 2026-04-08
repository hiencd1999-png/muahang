import { PrismaClient, Role, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Passwords must contain: 1 uppercase letter + 1 digit minimum
  // Admin creds: admin / Admin123
  // SPAdmin creds: spadmin / Spadmin123
  const adminPassword = "Admin123";
  const spadminPassword = "Spadmin123";
  const testPassword = "Test123";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const spadminHash = await bcrypt.hash(spadminPassword, 10);
  const testHash = await bcrypt.hash(testPassword, 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      fullName: "Quản trị viên",
      passwordHash: adminHash,
      email: "admin@datdon.local",
      phone: "0900000001",
      role: Role.ADMIN,
      balance: 5_000_000,
    },
    create: {
      fullName: "Quản trị viên",
      username: "admin",
      email: "admin@datdon.local",
      phone: "0900000001",
      passwordHash: adminHash,
      role: Role.ADMIN,
      balance: 5_000_000,
      transactions: {
        create: {
          amount: 5_000_000,
          type: TransactionType.ADMIN_ADJUSTMENT,
          note: "Initial admin balance",
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { username: "testuser" },
    update: {
      fullName: "Người dùng test",
      passwordHash: testHash,
      email: "testuser@datdon.local",
      phone: "0900000002",
      role: Role.USER,
      balance: 500_000,
    },
    create: {
      fullName: "Người dùng test",
      username: "testuser",
      email: "testuser@datdon.local",
      phone: "0900000002",
      passwordHash: testHash,
      role: Role.USER,
      balance: 500_000,
      transactions: {
        create: {
          amount: 500_000,
          type: TransactionType.ADMIN_ADJUSTMENT,
          note: "Test user balance",
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { username: "spadmin" },
    update: {
      fullName: "Super admin",
      passwordHash: spadminHash,
      email: "spadmin@datdon.local",
      phone: "0900000003",
      role: Role.SPADMIN,
      balance: 10_000_000,
    },
    create: {
      fullName: "Super admin",
      username: "spadmin",
      email: "spadmin@datdon.local",
      phone: "0900000003",
      passwordHash: spadminHash,
      role: Role.SPADMIN,
      balance: 10_000_000,
      transactions: {
        create: {
          amount: 10_000_000,
          type: TransactionType.ADMIN_ADJUSTMENT,
          note: "Initial spadmin balance",
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
