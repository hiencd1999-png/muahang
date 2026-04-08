import { SystemProxyManager } from "@/components/admin/system-proxy-manager";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function AdminProxyPage() {
  await requireUser("SPADMIN");

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

  return (
    <SystemProxyManager
      initialProxies={proxies.map((proxy) => ({
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        passwordMasked:
          proxy.password.length <= 2
            ? "*".repeat(proxy.password.length)
            : `${proxy.password[0]}${"*".repeat(Math.max(1, proxy.password.length - 2))}${proxy.password[proxy.password.length - 1]}`,
        isActive: proxy.isActive,
        createdAt: proxy.createdAt.toISOString(),
      }))}
    />
  );
}
