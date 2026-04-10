import { requireUser } from "@/lib/session";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <ProfileForm
      fullName={user.fullName || user.username}
      username={user.username}
      balance={user.balance}
      email={user.email}
      phone={user.phone}
      twoFactorEnabled={user.twoFactorEnabled}
      role={user.role}
    />
  );
}
