import { requireUser } from "@/lib/session";
import { PoliciesContent } from "@/components/shared/policies-content";

export const metadata = {
  title: "Chính sách Admin | DatDon",
};

export default async function AdminPoliciesPage() {
  const user = await requireUser("ADMIN");
  return <PoliciesContent role={user.role} />;
}
