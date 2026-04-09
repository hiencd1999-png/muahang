"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";
import { Modal } from "@/components/shared/modal";
import { USER_ROLES, type UserRole } from "@/lib/roles";

export function UserManagementControls({
  userId,
  username,
  currentRole,
  currentBalance,
  displayName,
  email,
  phone,
  canManageRoles,
  canEditUser,
  operatorIsSpAdmin = false,
}: {
  userId: number;
  username: string;
  currentRole: UserRole;
  currentBalance: number;
  displayName: string;
  email: string;
  phone: string;
  canManageRoles: boolean;
  canEditUser: boolean;
  operatorIsSpAdmin?: boolean;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [targetBalance, setTargetBalance] = useState(currentBalance);
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [nextRole, setNextRole] = useState<UserRole>(currentRole);
  const [isSaving, setIsSaving] = useState(false);
  const suggestedBalances = (operatorIsSpAdmin ? [
    currentBalance,
    currentBalance + 100_000,
    currentBalance + 500_000,
    Math.max(0, currentBalance - 100_000),
    Math.max(0, currentBalance - 500_000),
  ] : [
    currentBalance,
    currentBalance + 100_000,
    currentBalance + 500_000,
    currentBalance + 1_000_000,
  ]).filter((value, index, values) => values.indexOf(value) === index);

  useEffect(() => {
    setNextRole(currentRole);
    setTargetBalance(currentBalance);
  }, [currentRole, currentBalance]);

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    const randomValues = crypto.getRandomValues(new Uint32Array(14));
    const password = Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
    setGeneratedPassword(password);
  }

  async function copyGeneratedPassword() {
    if (!generatedPassword) {
      addToast("error", "Hãy reset mật khẩu trước khi sao chép.");
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedPassword);
      addToast("success", "Đã sao chép mật khẩu mới.");
    } catch {
      addToast("error", "Không thể sao chép mật khẩu.");
    }
  }

  async function handleSaveBalance() {
    if (!operatorIsSpAdmin && targetBalance < currentBalance) {
      addToast("error", "ADMIN chỉ có thể cấp thêm số dư, không được trừ.");
      return;
    }
    setIsSavingBalance(true);

    const response = await fetch(`/api/admin/user/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: targetBalance }),
    });

    const data = await response.json();

    if (response.ok) {
      addToast("success", "Cập nhật số dư thành công!");
      router.refresh();
    } else {
      addToast("error", data.error ?? "Điều chỉnh thất bại.");
    }

    setIsSavingBalance(false);
  }

  async function handleSaveUser() {
    const hasPasswordChange = generatedPassword.length > 0;
    const hasRoleChange = canManageRoles && nextRole !== currentRole;

    if (!hasPasswordChange && !hasRoleChange) {
      addToast("error", "Chưa có thay đổi nào để lưu.");
      return;
    }

    setIsSaving(true);

    const response = await fetch(`/api/admin/user/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(hasPasswordChange ? { password: generatedPassword } : {}),
        ...(hasRoleChange ? { role: nextRole } : {}),
      }),
    });

    const data = await response.json();

    if (response.ok) {
      addToast("success", "Cập nhật user thành công!");
      setGeneratedPassword("");
      setIsModalOpen(false);
      router.refresh();
    } else {
      addToast("error", data.error ?? "Không thể cập nhật user.");
    }

    setIsSaving(false);
  }

  return (
    <>
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={!canEditUser}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          title={
            !canEditUser
              ? currentRole === "SPADMIN"
                ? "SPADMIN không thể tác động lên SPADMIN khác."
                : "ADMIN chỉ được chỉnh sửa tài khoản có role USER."
              : "Quản lý user"
          }
        >
          {canEditUser ? "Quản lý user" : currentRole === "SPADMIN" ? "Bị hạn chế" : "Chỉ SPADMIN"}
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setGeneratedPassword("");
          setNextRole(currentRole);
          setTargetBalance(currentBalance);
        }}
        title={`Quản lý user @${username}`}
        size="large"
      >
        <div className="min-w-0 space-y-6 overflow-x-hidden">
          <div className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-gradient-to-r from-white to-amber-50 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                User profile
              </p>
              <h3 className="mt-2 truncate text-2xl font-semibold text-slate-950">
                {displayName}
              </h3>
              <p className="mt-1 text-sm text-slate-500">@{username}</p>
            </div>
            <div className="grid gap-3 sm:text-right">
              <div>
                <p className="text-xs font-medium text-slate-500">Role hiện tại</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{currentRole}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Số dư hiện tại</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">
                  {new Intl.NumberFormat("vi-VN").format(currentBalance)} VND
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Họ và tên</p>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900">{displayName}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Username</p>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900">@{username}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Số điện thoại</p>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900">{phone}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Email</p>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900">{email}</p>
            </div>
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="min-w-0 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Balance
                </p>
                <h4 className="mt-2 text-lg font-semibold text-slate-950">
                  {operatorIsSpAdmin ? "Điều chỉnh số dư (SPADMIN)" : "Chuyển tiền cho User"}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  {operatorIsSpAdmin 
                    ? "Là SPADMIN, bạn có thể điều chỉnh số dư tùy ý mà không bị trừ tiền cá nhân."
                    : "Nhập số dư mới (cao hơn hiện tại). Số tiền chênh lệch sẽ được trừ trực tiếp vào số dư của Admin."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {suggestedBalances.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTargetBalance(value)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      targetBalance === value
                        ? "border-amber-400 bg-amber-50 text-amber-900"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-200 hover:bg-amber-50/60"
                    }`}
                  >
                    {new Intl.NumberFormat("vi-VN").format(value)} VND
                  </button>
                ))}
              </div>

              <label className="mt-4 block space-y-2 text-sm font-medium text-slate-700">
                <span>
                  Số dư mới {operatorIsSpAdmin 
                    ? "(Toàn quyền điều chỉnh)" 
                    : `(Tối thiểu ${new Intl.NumberFormat("vi-VN").format(currentBalance)} VND)`}
                </span>
                <input
                  type="number"
                  min={operatorIsSpAdmin ? 0 : currentBalance}
                  step={1000}
                  value={targetBalance}
                  onChange={(event) => setTargetBalance(Number(event.target.value) || 0)}
                  className="block w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
                />
              </label>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">So sánh với số dư cũ</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">Số dư cũ</p>
                    <p className="mt-1 font-semibold">{new Intl.NumberFormat("vi-VN").format(currentBalance)} VND</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Số dư mới</p>
                    <p className="mt-1 font-semibold">{new Intl.NumberFormat("vi-VN").format(targetBalance)} VND</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      {operatorIsSpAdmin ? "Chênh lệch" : "Chênh lệch (Admin bị trừ)"}
                    </p>
                    <p className={`mt-1 font-semibold ${targetBalance - currentBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {targetBalance - currentBalance >= 0 ? "+" : ""}
                      {new Intl.NumberFormat("vi-VN").format(targetBalance - currentBalance)} VND
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleSaveBalance}
                  disabled={isSavingBalance || targetBalance === currentBalance}
                  className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition shadow-lg shadow-amber-100 disabled:opacity-60 ${
                    operatorIsSpAdmin ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isSavingBalance ? "Đang cập nhật..." : operatorIsSpAdmin ? "Lưu số dư mới" : "Xác nhận chuyển tiền"}
                </button>
              </div>
            </section>

            <section className="min-w-0 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Account
                </p>
                <h4 className="mt-2 text-lg font-semibold text-slate-950">Thông tin user</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Xem đầy đủ thông tin user, reset mật khẩu ngẫu nhiên và cập nhật role ngay trong một form rộng, rõ ràng.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Reset mật khẩu</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Bấm nút để sinh mật khẩu mới ngẫu nhiên. Admin có thể sao chép và gửi lại cho user.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 shadow-sm"
                      >
                        Reset mật khẩu
                      </button>
                      <button
                        type="button"
                        onClick={copyGeneratedPassword}
                        disabled={!generatedPassword}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Mật khẩu mới</p>
                    <p className="mt-2 break-all font-mono text-sm text-slate-900">
                      {generatedPassword || "Chưa tạo mật khẩu mới"}
                    </p>
                  </div>
                </div>

                {canManageRoles ? (
                  <label className="block min-w-0 space-y-2 text-sm font-medium text-slate-700">
                    <span>Role</span>
                    <select
                      value={nextRole}
                      onChange={(event) => setNextRole(event.target.value as UserRole)}
                      className="block w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      SPADMIN có thể thay đổi role của user.
                    </p>
                  </label>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setGeneratedPassword("");
                    setNextRole(currentRole);
                    setTargetBalance(currentBalance);
                  }}
                  className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                  disabled={isSaving}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveUser}
                  className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  disabled={isSaving}
                >
                  {isSaving ? "Đang lưu..." : "Lưu thông tin user"}
                </button>
              </div>
            </section>
          </div>
        </div>
      </Modal>
    </>
  );
}
