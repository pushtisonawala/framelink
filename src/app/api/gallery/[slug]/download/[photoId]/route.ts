import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, Errors } from "@/lib/api";
import { loadGalleryBySlug, assertGalleryViewable } from "@/lib/gallery";
import { requireGalleryAccess } from "@/lib/gallery-session";
import { signedUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Ctx = { params: { slug: string; photoId: string } };

/**
 * Redirect the customer to a short-lived signed URL that forces a download of
 * the full-resolution original. Only works when the gallery allows downloads
 * and the photo actually belongs to this gallery.
 */
export const GET = handler(async (_req, { params }: Ctx) => {
  const gallery = await loadGalleryBySlug(params.slug);
  assertGalleryViewable(gallery);
  await requireGalleryAccess(params.slug);

  if (!gallery.allowDownload) {
    throw Errors.forbidden("Downloads are disabled for this gallery");
  }

  const link = await prisma.galleryPhoto.findFirst({
    where: { galleryId: gallery.id, photoId: params.photoId },
    select: { photo: { select: { storageKey: true, filename: true } } },
  });
  if (!link) throw Errors.notFound("Photo not found in this gallery");

  const url = await signedUrl(link.photo.storageKey, {
    expiresIn: 120,
    download: link.photo.filename,
  });
  return NextResponse.redirect(url, 302);
});
