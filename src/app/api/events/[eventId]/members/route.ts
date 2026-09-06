import { prisma } from "@/lib/prisma";
import { handler, json, parseJson, Errors } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess, assertAdmin } from "@/lib/authz";
import { addMemberSchema } from "@/lib/validation";
import { hashPassword, generateTempPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { eventId: string } };

export const GET = handler(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  await assertEventAccess(user, params.eventId);

  const members = await prisma.eventMember.findMany({
    where: { eventId: params.eventId },
    orderBy: { addedAt: "asc" },
    select: {
      addedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  return json({ members });
});

/**
 * Add a team member to an event (Admin/Lead only).
 * If the email is new, a TEAM_MEMBER account is created with a one-time password
 * that is returned ONCE in the response for the admin to hand over.
 */
export const POST = handler(async (req, { params }: Ctx) => {
  const admin = await requireUser();
  assertAdmin(admin);
  await assertEventAccess(admin, params.eventId);

  const { email, name } = await parseJson(req, addMemberSchema);

  let tempPassword: string | null = null;
  let member = await prisma.user.findUnique({ where: { email } });

  if (!member) {
    tempPassword = generateTempPassword();
    member = await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0]!,
        role: "TEAM_MEMBER",
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
    });
  }

  if (member.role === "ADMIN") {
    throw Errors.badRequest("That user is an Admin and cannot be added as a team member");
  }

  try {
    await prisma.eventMember.create({
      data: { eventId: params.eventId, userId: member.id },
    });
  } catch {
    throw Errors.conflict("That user is already a member of this event");
  }

  return json(
    {
      member: {
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
      },
      tempPassword, // null when the user already existed
    },
    { status: 201 },
  );
});
