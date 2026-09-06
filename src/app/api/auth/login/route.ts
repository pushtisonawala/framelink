import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession } from "@/lib/auth";
import { handler, json, parseJson, Errors } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { getEnv } from "@/lib/env";
import { sessionCookieOptions } from "@/lib/session";

export const POST = handler(async (req) => {
  const { email, password } = await parseJson(req, loginSchema);

  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-ish response: always run a hash comparison to reduce timing signal.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "$2a$12$0000000000000000000000000000000000000000000000000000");

  if (!user || !ok) throw Errors.unauthorized("Invalid email or password");

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  cookies().set(getEnv().SESSION_COOKIE_NAME, token, sessionCookieOptions(60 * 60 * 24 * 7));

  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
});
