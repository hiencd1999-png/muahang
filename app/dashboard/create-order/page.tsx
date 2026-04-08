import { requireUser } from "@/lib/session";
import { CreateOrderForm } from "@/components/dashboard/create-order-form";

export default async function CreateOrderPage() {
  const user = await requireUser();

  return <CreateOrderForm balance={user.balance} />;
}
