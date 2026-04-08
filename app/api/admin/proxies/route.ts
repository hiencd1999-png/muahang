import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

const bulkImportSchema = z.object({
  proxiesText: z.string().trim().min(1),
});

const deleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

type ParsedProxy = {
  host: string;
  port: number;
  username: string;
  password: string;
};

function buildProxyKey(proxy: ParsedProxy) {
  return `${proxy.host.trim()}:${proxy.port}:${proxy.username.trim()}:${proxy.password.trim()}`;
}

function parseProxyLine(line: string): ParsedProxy | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 4) {
    return null;
  }

  const host = parts[0]?.trim();
  const portText = parts[1]?.trim();
  const username = parts[2]?.trim();
  const password = parts[3]?.trim();

  if (!host || !portText || !username || !password) {
    return null;
  }

  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return { host, port, username, password };
}

function maskSecret(value: string) {
  if (value.length <= 2) {
    return "*".repeat(value.length);
  }

  return `${value[0]}${"*".repeat(Math.max(1, value.length - 2))}${value[value.length - 1]}`;
}

export async function GET() {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const proxies = await prisma.systemProxy.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      host: true,
      port: true,
      username: true,
      password: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    proxies: proxies.map((proxy) => ({
      id: proxy.id,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      passwordMasked: maskSecret(proxy.password),
      isActive: proxy.isActive,
      createdAt: proxy.createdAt,
      updatedAt: proxy.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = bulkImportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu proxy import không hợp lệ." }, { status: 400 });
  }

  const lines = parsed.data.proxiesText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const validRows: ParsedProxy[] = [];
  const invalidRows: string[] = [];

  for (const line of lines) {
    const parsedLine = parseProxyLine(line);
    if (!parsedLine) {
      invalidRows.push(line);
      continue;
    }

    validRows.push(parsedLine);
  }

  if (validRows.length === 0) {
    return NextResponse.json({
      error: "Không có proxy hợp lệ. Định dạng cần là ip:port:user:pass.",
      invalidRows,
    }, { status: 400 });
  }

  const uniqueRows = Array.from(
    new Map(validRows.map((row) => [buildProxyKey(row), row])).values()
  );

  const duplicateInInputCount = validRows.length - uniqueRows.length;

  const existingProxies = await prisma.systemProxy.findMany({
    select: {
      host: true,
      port: true,
      username: true,
      password: true,
    },
  });

  const existingKeys = new Set(existingProxies.map((proxy) => buildProxyKey(proxy)));
  const rowsToCreate = uniqueRows.filter((row) => !existingKeys.has(buildProxyKey(row)));
  const duplicateInSystemCount = uniqueRows.length - rowsToCreate.length;

  if (rowsToCreate.length > 0) {
    await prisma.systemProxy.createMany({
      data: rowsToCreate.map((row) => ({
        host: row.host,
        port: row.port,
        username: row.username,
        password: row.password,
        isActive: true,
      })),
    });
  }

  const createdCount = rowsToCreate.length;

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_IMPORT_SYSTEM_PROXIES",
    targetType: "SYSTEM_PROXY",
    details: {
      totalLines: lines.length,
      validRows: validRows.length,
      uniqueRows: uniqueRows.length,
      duplicateInInputCount,
      duplicateInSystemCount,
      createdCount,
      invalidRows,
    },
  });

  revalidatePath("/admin/proxies");

  return NextResponse.json({
    success: true,
    createdCount,
    duplicateInInputCount,
    duplicateInSystemCount,
    invalidRows,
  });
}

export async function DELETE(request: Request) {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Danh sách proxy cần xóa không hợp lệ." }, { status: 400 });
  }

  const ids = Array.from(new Set(parsed.data.ids));
  const removed = await prisma.systemProxy.deleteMany({
    where: { id: { in: ids } },
  });

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_DELETE_SYSTEM_PROXIES",
    targetType: "SYSTEM_PROXY",
    details: {
      ids,
      deleted: removed.count,
    },
  });

  revalidatePath("/admin/proxies");

  return NextResponse.json({ success: true, deleted: removed.count });
}
