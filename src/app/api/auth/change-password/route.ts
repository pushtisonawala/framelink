import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, signSession } from "@/lib/auth";
import { handler, json, parseJson, Errors } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation";
import { getEnv } from "@/lib/env";
import { requireUser, sessionCookieOptions } from "@/lib/session";

export const POST = handler(async (req) => {
  const current = await requireUser();
  const { currentPassword, newPassword } = await parseJson(req, changePasswordSchema);

  const user = await prisma.user.findUnique({ where: { id: current.id } });
  if (!user) throw Errors.unauthorized();

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw Errors.badRequest("Current password is incorrect");
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw Errors.badRequest("New password must be different from the current one");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });

  // Refresh session token.
  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  cookies().set(getEnv().SESSION_COOKIE_NAME, token, sessionCookieOptions(60 * 60 * 24 * 7));

  return json({ ok: true });
});
