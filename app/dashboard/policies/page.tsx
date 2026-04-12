import { requireUser } from "@/lib/session";
import { PoliciesContent } from "@/components/shared/policies-content";

export const metadata = {
  title: "Chính sách & Hướng dẫn | DatDon",
};

export default async function PoliciesPage() {
  const user = await requireUser();
  return <PoliciesContent role={user.role} />;
}
