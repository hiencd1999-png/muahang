import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect(session.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  return (
    <main className="shell flex flex-1 items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-xl">
        <LoginForm />
      </div>
    </main>
  );
}
