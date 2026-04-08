import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isSpAdminRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const currentAdmin = await requireUser("ADMIN");
  const canViewAllLogs = isSpAdminRole(currentAdmin.role);

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = 20;
  const adminId = searchParams.get("adminId");
  const action = searchParams.get("action");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const where: any = canViewAllLogs ? {} : { adminId: currentAdmin.id };

    if (canViewAllLogs && adminId) {
      where.adminId = parseInt(adminId);
    }

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { admin: { select: { id: true, username: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Get unique actions and admins for filter options
    const actions = await prisma.auditLog.findMany({
      where: canViewAllLogs ? {} : { adminId: currentAdmin.id },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    });

    const admins = canViewAllLogs
      ? await prisma.auditLog.findMany({
          distinct: ["adminId"],
          select: { admin: { select: { id: true, username: true } } },
          orderBy: { admin: { username: "asc" } },
        })
      : [];

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      actions: actions.map((a) => a.action),
      admins: admins.map((a) => a.admin),
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    return NextResponse.json({ error: "Không thể tải nhật ký hoạt động." }, { status: 500 });
  }
}
