import { prisma } from "@/lib/prisma";
import { handler, json, Errors } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess } from "@/lib/authz";
import { signedUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Ctx = { params: { photoId: string } };

/** Short-lived signed URL for the full-resolution original (team/admin view). */
export const GET = handler(async (req, { params }: Ctx) => {
  const user = await requireUser();

  const photo = await prisma.photo.findUnique({
    where: { id: params.photoId },
    select: {
      eventId: true,
      uploadedById: true,
      storageKey: true,
      status: true,
      filename: true,
    },
  });
  if (!photo || photo.status !== "READY") throw Errors.notFound("Photo not found");

  const { isAdmin } = await assertEventAccess(user, photo.eventId);
  if (!isAdmin && photo.uploadedById !== user.id) {
    throw Errors.forbidden("You can only view photos you uploaded");
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const url = await signedUrl(photo.storageKey, {
    expiresIn: 900,
    download: download ? photo.filename : false,
  });
  return json({ url });
});
