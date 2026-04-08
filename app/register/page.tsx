import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getSession } from "@/lib/session";

export default async function RegisterPage() {
  const session = await getSession();

  if (session) {
    redirect(session.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  return (
    <main className="shell flex flex-1 items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-xl">
        <RegisterForm />
      </div>
    </main>
  );
}
