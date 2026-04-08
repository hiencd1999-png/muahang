import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "datdon_session";
export type UserRole = "USER" | "ADMIN";

export type SessionPayload = {
  sub: string;
  username: string;
  role: UserRole;
};

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET ?? "datdon-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());

  return {
    sub: payload.sub ?? "",
    username: String(payload.username ?? ""),
    role: String(payload.role ?? "USER") as UserRole,
  } satisfies SessionPayload;
}
