import { requireUser } from "@/lib/session";
import { AdminLogsView } from "@/components/admin/logs-view";
import { prisma } from "@/lib/prisma";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    adminId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  await requireUser("ADMIN");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 20;

  // Build where clause for filtering
  const where: any = {};

  if (params.adminId) {
    where.adminId = parseInt(params.adminId);
  }

  if (params.action) {
    where.action = params.action;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
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
