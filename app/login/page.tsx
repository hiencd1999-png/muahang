import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/session";
import { getPostLoginRedirect } from "@/lib/roles";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getPostLoginRedirect(user.role));
  }

  return (
    <main className="shell flex flex-1 items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-xl">
        <LoginForm />
      </div>
    </main>
  );
}
