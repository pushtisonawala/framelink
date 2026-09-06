import { prisma } from "@/lib/prisma";
import { handler, json, parseJson, Errors } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess, assertAdmin } from "@/lib/authz";
import { updateEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: { eventId: string } };

export const GET = handler(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { isAdmin } = await assertEventAccess(user, params.eventId);

  const event = await prisma.event.findUniqueOrThrow({
    where: { id: params.eventId },
    select: {
      id: true,
      name: true,
      description: true,
      date: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      members: {
        select: {
          addedAt: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { addedAt: "asc" },
      },
      _count: { select: { photos: true, galleries: true } },
    },
  });

  const selectedCount = await prisma.photo.count({
    where: { eventId: params.eventId, selected: true, status: "READY" },
  });

  return json({ event: { ...event, selectedCount, viewerIsAdmin: isAdmin } });
});

export const PATCH = handler(async (req, { params }: Ctx) => {
  const user = await requireUser();
  assertAdmin(user);
  await assertEventAccess(user, params.eventId);

  const input = await parseJson(req, updateEventSchema);
  const event = await prisma.event.update({
    where: { id: params.eventId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description || null }
        : {}),
      ...(input.date !== undefined ? { date: input.date ?? null } : {}),
    },
    select: { id: true, name: true, description: true, date: true },
  });
  return json({ event });
});

export const DELETE = handler(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  assertAdmin(user);
  await assertEventAccess(user, params.eventId);

  // Photos/galleries cascade in the DB; storage cleanup is handled by a
  // separate janitor in production. For the challenge we block deletion of
  // events that still hold photos to avoid orphaned objects.
  const photoCount = await prisma.photo.count({ where: { eventId: params.eventId } });
  if (photoCount > 0) {
    throw Errors.conflict(
      "Delete or move the event's photos before deleting the event",
    );
  }

  await prisma.event.delete({ where: { id: params.eventId } });
  return json({ ok: true });
});
