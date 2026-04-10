import { requireUser } from "@/lib/session";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { getTelegramConfigs } from "@/lib/telegram";

export default async function ProfilePage() {
  const user = await requireUser();
  const telegramConfig = await getTelegramConfigs();

  return (
    <ProfileForm
      fullName={user.fullName || user.username}
      username={user.username}
      balance={user.balance}
      email={user.email}
      phone={user.phone}
      twoFactorEnabled={user.twoFactorEnabled}
      role={user.role}
      telegramId={user.telegramId}
      telegramUsername={user.telegramUsername}
      telegramEnabled={telegramConfig.enabled}
    />
  );
}
