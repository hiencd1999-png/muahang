export const ADMIN_ROLES = ["ADMIN", "SPADMIN"] as const;
export const USER_ROLES = ["USER", "ADMIN", "SPADMIN"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type UserRole = (typeof USER_ROLES)[number];

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === "ADMIN" || role === "SPADMIN";
}

export function isSpAdminRole(role: string | null | undefined): role is "SPADMIN" {
  return role === "SPADMIN";
}

export function getPostLoginRedirect(role: string | null | undefined) {
  return isAdminRole(role) ? "/admin" : "/dashboard";
}