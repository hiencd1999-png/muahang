import { requireUser } from "@/lib/session";
import { AdminLogsView } from "@/components/admin/logs-view";
import { prisma } from "@/lib/prisma";
import { isSpAdminRole } from "@/lib/roles";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 500] as const;

function getPageSize(value?: string) {
  const parsed = Number.parseInt(value || "20", 10);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : 20;
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    adminId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const currentAdmin = await requireUser("ADMIN");
  const canViewAllLogs = isSpAdminRole(currentAdmin.role);

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = getPageSize(params.pageSize);

  const where: any = canViewAllLogs ? {} : { adminId: currentAdmin.id };

  if (canViewAllLogs && params.adminId) {
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
      where: canViewAllLogs ? {} : { adminId: currentAdmin.id },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    canViewAllLogs
      ? prisma.auditLog.findMany({
          distinct: ["adminId"],
          select: { admin: { select: { id: true, username: true } } },
          orderBy: { admin: { username: "asc" } },
        })
      : Promise.resolve([]),
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
      initialPageSize={limit}
      initialActions={actionList}
      initialAdmins={adminList}
      canViewAllLogs={canViewAllLogs}
    />
  );
}
