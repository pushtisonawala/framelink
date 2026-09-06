import { prisma } from "@/lib/prisma";
import { handler, json, parseJson } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/session";
import { createEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** List events visible to the caller. Admin: all. Team member: assigned only. */
export const GET = handler(async () => {
  const user = await requireUser();

  const where =
    user.role === "ADMIN" ? {} : { members: { some: { userId: user.id } } };

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      date: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { photos: true, members: true, galleries: true } },
    },
  });

  return json({ events });
});

/** Create an event (Admin/Lead only). */
export const POST = handler(async (req) => {
  const user = await requireRole("ADMIN");
  const input = await parseJson(req, createEventSchema);

  const event = await prisma.event.create({
    data: {
      name: input.name,
      description: input.description || null,
      date: input.date ?? null,
      createdById: user.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      date: true,
      createdAt: true,
    },
  });

  return json({ event }, { status: 201 });
});
