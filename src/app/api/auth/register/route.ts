import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, signSession } from "@/lib/auth";
import { handler, json, parseJson, Errors } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { getEnv } from "@/lib/env";
import { sessionCookieOptions } from "@/lib/session";

/**
 * Self-service registration. The first account and every self-registered account
 * is an ADMIN / Lead (they own events and add team members). Team members are
 * created by an admin via POST /api/events/:id/members and never register here.
 */
export const POST = handler(async (req) => {
  const { name, email, password } = await parseJson(req, registerSchema);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Errors.conflict("An account with that email already exists");

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
    },
    select: { id: true, email: true, name: true, role: true },
  });

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  cookies().set(getEnv().SESSION_COOKIE_NAME, token, sessionCookieOptions(60 * 60 * 24 * 7));

  return json({ user }, { status: 201 });
});
