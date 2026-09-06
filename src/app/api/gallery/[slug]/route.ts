import { handler, json } from "@/lib/api";
import { loadGalleryBySlug, toPublicState, isExpired } from "@/lib/gallery";
import { hasGalleryAccess } from "@/lib/gallery-session";
import { Errors } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: { slug: string } };

/**
 * Public metadata for the gallery landing page. Never returns photos.
 * A 404 is returned for unpublished galleries so their existence isn't leaked.
 */
export const GET = handler(async (_req, { params }: Ctx) => {
  const gallery = await loadGalleryBySlug(params.slug);
  if (!gallery.published) throw Errors.notFound("Gallery not found");

  const expired = isExpired(gallery.expiresAt);
  const unlocked = !expired && (await hasGalleryAccess(params.slug));

  return json({
    gallery: {
      slug: gallery.slug,
      title: gallery.title,
      eventName: gallery.event.name,
      photoCount: gallery._count.photos,
      allowDownload: gallery.allowDownload,
      expired,
      unlocked,
    },
  });
});
