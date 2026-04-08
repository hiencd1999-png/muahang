import { requireUser } from "@/lib/session";
import { AdminLogsView } from "@/components/admin/logs-view";
import { prisma } from "@/lib/prisma";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    adminId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  };
}) {
  await requireUser("ADMIN");

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const limit = 20;

  // Build where clause for filtering
  const where: any = {};

  if (searchParams.adminId) {
    where.adminId = parseInt(searchParams.adminId);
  }

  if (searchParams.action) {
    where.action = searchParams.action;
  }

  if (searchParams.startDate || searchParams.endDate) {
    where.createdAt = {};
    if (searchParams.startDate) {
      where.createdAt.gte = new Date(searchParams.startDate);
    }
    if (searchParams.endDate) {
      const end = new Date(searchParams.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [logs, total, actions, admins] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { username: true, id: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["adminId"],
      select: { admin: { select: { id: true, username: true } } },
      orderBy: { admin: { username: "asc" } },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Convert to serializable format
  const serializedLogs = logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }));

  const actionList = actions.map((a) => a.action);
  const adminList = admins.map((a) => a.admin);

  return (
    <AdminLogsView
      initialLogs={serializedLogs as any}
      initialTotal={total}
      initialPage={page}
      initialActions={actionList}
      initialAdmins={adminList}
    />
  );
}
