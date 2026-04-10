import { PrismaClient, Role, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LEGACY_VOUCHER_CODES } from "../lib/voucher";

const prisma = new PrismaClient();

const defaultVoucherPricing = [
  { code: "MA_80K", label: "Mã 80k", unitPrice: 80_000 },
  { code: "MA_100K", label: "Mã 100k", unitPrice: 100_000 },
  { code: "MA_50_100K", label: "Mã 50%/100k", unitPrice: 100_000 },
  { code: "MA_50_200K", label: "Mã 50%/200k", unitPrice: 200_000 },
  { code: "MA_60K", label: "Mã 60k", unitPrice: 60_000 },
] as const;

async function main() {
  // Initialize Advanced Fintech Ledgers
  await prisma.systemAccount.upsert({ where: { id: "SYSTEM_REVENUE" }, update: {}, create: { id: "SYSTEM_REVENUE", name: "Doanh Thu Hệ Thống" } });
  await prisma.systemAccount.upsert({ where: { id: "SYSTEM_ESCROW" }, update: {}, create: { id: "SYSTEM_ESCROW", name: "Quỹ Trung Gian" } });
  await prisma.systemAccount.upsert({ where: { id: "ADMIN_LIQUIDITY_POOL" }, update: {}, create: { id: "ADMIN_LIQUIDITY_POOL", name: "Kho Thanh Khoản SPADMIN" } });

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
    update: {},
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
    update: {},
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
    update: {},
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

  await prisma.voucherPricing.deleteMany({
    where: {
      code: {
        in: LEGACY_VOUCHER_CODES,
      },
    },
  });

  await Promise.all(
    defaultVoucherPricing.map((voucher) =>
      prisma.voucherPricing.upsert({
        where: { code: voucher.code },
        update: {},
        create: {
          code: voucher.code,
          label: voucher.label,
          unitPrice: voucher.unitPrice,
        },
      })
    )
  );
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
