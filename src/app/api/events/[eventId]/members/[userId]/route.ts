import { prisma } from "@/lib/prisma";
import { handler, json, Errors } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess, assertAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

type Ctx = { params: { eventId: string; userId: string } };

export const DELETE = handler(async (_req, { params }: Ctx) => {
  const admin = await requireUser();
  assertAdmin(admin);
  await assertEventAccess(admin, params.eventId);

  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId: params.eventId, userId: params.userId } },
  });
  if (!membership) throw Errors.notFound("That user is not a member of this event");

  await prisma.eventMember.delete({
    where: { eventId_userId: { eventId: params.eventId, userId: params.userId } },
  });
  return json({ ok: true });
});
