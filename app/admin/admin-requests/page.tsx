import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AdminRequestsView } from "./admin-requests-view";
import { isSpAdminRole } from "@/lib/roles";

export const metadata = {
  title: "Yêu Cầu Làm Admin | Quản trị SPAdmin",
};

export default async function AdminRequestsPage() {
  const admin = await requireUser("ADMIN");
  
  if (!isSpAdminRole(admin.role)) {
    redirect("/admin");
  }

  const requests = await prisma.adminRequest.findMany({
    include: {
      user: {
        select: {
          username: true,
          fullName: true,
          role: true,
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return <AdminRequestsView requests={requests} />;
}
