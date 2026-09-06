import { cookies } from "next/headers";
import { cache } from "react";
import { getEnv } from "./env";
import { verifySession, type SessionClaims } from "./auth";
import { prisma } from "./prisma";
import { Errors } from "./api";
import type { Role, User } from "@prisma/client";

export type SessionUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "mustChangePassword"
>;

/** Read + verify the session cookie. Returns null when unauthenticated. */
export const getSessionClaims = cache(async (): Promise<SessionClaims | null> => {
  const token = cookies().get(getEnv().SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
});

/** Load the current user from the DB (source of truth for role changes). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await getSessionClaims();
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mustChangePassword: true,
    },
  });
  return user;
});

/** Throw 401 unless authenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  return user;
}

/** Throw 401/403 unless authenticated with one of the allowed roles. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw Errors.forbidden(`Requires role: ${roles.join(" or ")}`);
  }
  return user;
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
