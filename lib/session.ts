import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, type UserRole, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();

  if (!session?.sub) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: Number(session.sub) },
  });
}

export async function requireUser(requiredRole?: UserRole) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (requiredRole && user.role !== requiredRole) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireApiUser(requiredRole?: UserRole) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  if (requiredRole && user.role !== requiredRole) {
    return { error: "Forbidden", status: 403 } as const;
  }

  return { user } as const;
}
