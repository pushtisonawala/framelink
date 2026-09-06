import { prisma } from "@/lib/prisma";
import { handler, json, parseJson, Errors } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess, assertAdmin } from "@/lib/authz";
import { updateGallerySchema } from "@/lib/validation";
import { generatePin, hashPin } from "@/lib/auth";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Ctx = { params: { galleryId: string } };

async function loadOwnedGallery(galleryId: string) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      eventId: true,
      title: true,
      slug: true,
      published: true,
      publishedAt: true,
      expiresAt: true,
      allowDownload: true,
      createdAt: true,
      _count: { select: { photos: true } },
    },
  });
  if (!gallery) throw Errors.notFound("Gallery not found");
  return gallery;
}

export const GET = handler(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  assertAdmin(user);
  const gallery = await loadOwnedGallery(params.galleryId);
  await assertEventAccess(user, gallery.eventId);

  const photos = await prisma.galleryPhoto.findMany({
    where: { galleryId: gallery.id },
    orderBy: { order: "asc" },
    select: {
      order: true,
      photo: {
        select: { id: true, filename: true, width: true, height: true, thumbnailKey: true },
      },
    },
  });

  return json({
    gallery: { ...gallery, url: absoluteUrl(`/gallery/${gallery.slug}`) },
    photos: photos.map((p) => ({ order: p.order, ...p.photo })),
  });
});

export const PATCH = handler(async (req, { params }: Ctx) => {
  const user = await requireUser();
  assertAdmin(user);
  const gallery = await loadOwnedGallery(params.galleryId);
  await assertEventAccess(user, gallery.eventId);

  const input = await parseJson(req, updateGallerySchema);

  let newPin: string | null = null;
  const data: Record<string, unknown> = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.allowDownload !== undefined) data.allowDownload = input.allowDownload;
  if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;
  if (input.published !== undefined) {
    data.published = input.published;
    data.publishedAt = input.published ? new Date() : null;
  }
  if (input.rotatePin || input.pin) {
    newPin = input.pin ?? generatePin(6);
    data.pinHash = await hashPin(newPin);
  }

  if (input.photoIds) {
    const valid = await prisma.photo.findMany({
      where: { id: { in: input.photoIds }, eventId: gallery.eventId, status: "READY" },
      select: { id: true },
    });
    if (valid.length === 0) throw Errors.badRequest("No valid photos supplied");
    await prisma.$transaction([
      prisma.galleryPhoto.deleteMany({ where: { galleryId: gallery.id } }),
      prisma.galleryPhoto.createMany({
        data: valid.map((p, i) => ({ galleryId: gallery.id, photoId: p.id, order: i })),
      }),
    ]);
  }

  const updated = await prisma.gallery.update({
    where: { id: gallery.id },
    data,
    select: {
      id: true,
      title: true,
      slug: true,
      published: true,
      publishedAt: true,
      expiresAt: true,
      allowDownload: true,
      _count: { select: { photos: true } },
    },
  });

  return json({
    gallery: { ...updated, url: absoluteUrl(`/gallery/${updated.slug}`) },
    ...(newPin ? { pin: newPin } : {}),
  });
});

export const DELETE = handler(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  assertAdmin(user);
  const gallery = await loadOwnedGallery(params.galleryId);
  await assertEventAccess(user, gallery.eventId);

  await prisma.gallery.delete({ where: { id: gallery.id } });
  return json({ ok: true });
});
