import { prisma } from "@/lib/prisma";
import { handler, json, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess, assertAdmin } from "@/lib/authz";
import { selectPhotosSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: { eventId: string } };

/** Bulk mark/unmark photos as selected for the gallery (Admin/Lead only). */
export const POST = handler(async (req, { params }: Ctx) => {
  const user = await requireUser();
  assertAdmin(user);
  await assertEventAccess(user, params.eventId);

  const { photoIds, selected } = await parseJson(req, selectPhotosSchema);

  // Only touch photos that actually belong to this event and are READY.
  const result = await prisma.photo.updateMany({
    where: { id: { in: photoIds }, eventId: params.eventId, status: "READY" },
    data: { selected },
  });

  const selectedCount = await prisma.photo.count({
    where: { eventId: params.eventId, selected: true, status: "READY" },
  });

  return json({ updated: result.count, selectedCount });
});
