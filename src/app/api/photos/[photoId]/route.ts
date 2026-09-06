import { prisma } from "@/lib/prisma";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertPhotoManage } from "@/lib/authz";
import { deleteObjects } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Ctx = { params: { photoId: string } };

export const DELETE = handler(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  await assertPhotoManage(user, params.photoId);

  const photo = await prisma.photo.findUniqueOrThrow({
    where: { id: params.photoId },
    select: { storageKey: true, thumbnailKey: true },
  });

  await prisma.photo.delete({ where: { id: params.photoId } });
  await deleteObjects(
    [photo.storageKey, photo.thumbnailKey].filter(Boolean) as string[],
  ).catch((e) => console.warn("[photo delete] storage cleanup failed", e));

  return json({ ok: true });
});
