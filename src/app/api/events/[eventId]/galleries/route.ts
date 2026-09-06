import { prisma } from "@/lib/prisma";
import { handler, json, parseJson, Errors } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess, assertAdmin } from "@/lib/authz";
import { createGallerySchema } from "@/lib/validation";
import { generatePin, hashPin } from "@/lib/auth";
import { newGallerySlug, absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Ctx = { params: { eventId: string } };

export const GET = handler(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  await assertEventAccess(user, params.eventId);
  assertAdmin(user);

  const galleries = await prisma.gallery.findMany({
    where: { eventId: params.eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
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

  return json({
    galleries: galleries.map((g) => ({
      ...g,
      url: absoluteUrl(`/gallery/${g.slug}`),
    })),
  });
});

/**
 * Create + (by default) publish a gallery from a set of selected photos.
 * Returns the shareable URL and, ONCE, the generated PIN.
 */
export const POST = handler(async (req, { params }: Ctx) => {
  const user = await requireUser();
  assertAdmin(user);
  await assertEventAccess(user, params.eventId);

  const input = await parseJson(req, createGallerySchema);

  // Validate every requested photo belongs to this event and is READY.
  const validPhotos = await prisma.photo.findMany({
    where: { id: { in: input.photoIds }, eventId: params.eventId, status: "READY" },
    select: { id: true },
  });
  if (validPhotos.length === 0) {
    throw Errors.badRequest("None of the selected photos are valid for this event");
  }

  const pin = input.pin ?? generatePin(6);
  const slug = newGallerySlug();

  const gallery = await prisma.gallery.create({
    data: {
      eventId: params.eventId,
      createdById: user.id,
      title: input.title,
      slug,
      pinHash: await hashPin(pin),
      allowDownload: input.allowDownload,
      expiresAt: input.expiresAt ?? null,
      published: input.publish,
      publishedAt: input.publish ? new Date() : null,
      photos: {
        create: validPhotos.map((p, i) => ({ photoId: p.id, order: i })),
      },
    },
    select: { id: true, slug: true, title: true, published: true, expiresAt: true },
  });

  return json(
    {
      gallery: {
        ...gallery,
        url: absoluteUrl(`/gallery/${gallery.slug}`),
        photoCount: validPhotos.length,
      },
      pin, // shown once — not retrievable later
    },
    { status: 201 },
  );
});
