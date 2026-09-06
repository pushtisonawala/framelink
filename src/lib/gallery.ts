import { prisma } from "./prisma";
import { Errors } from "./api";

export interface PublicGalleryState {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  expired: boolean;
  allowDownload: boolean;
  photoCount: number;
  eventName: string;
}

export async function loadGalleryBySlug(slug: string) {
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      pinHash: true,
      published: true,
      publishedAt: true,
      expiresAt: true,
      allowDownload: true,
      event: { select: { name: true } },
      _count: { select: { photos: true } },
    },
  });
  if (!gallery) throw Errors.notFound("Gallery not found");
  return gallery;
}

export function isExpired(expiresAt: Date | null): boolean {
  return !!expiresAt && expiresAt.getTime() < Date.now();
}

export function toPublicState(
  g: Awaited<ReturnType<typeof loadGalleryBySlug>>,
): PublicGalleryState {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    published: g.published,
    expired: isExpired(g.expiresAt),
    allowDownload: g.allowDownload,
    photoCount: g._count.photos,
    eventName: g.event.name,
  };
}

/** Guard used by every public gallery data route. */
export function assertGalleryViewable(
  g: Awaited<ReturnType<typeof loadGalleryBySlug>>,
): void {
  if (!g.published) throw Errors.notFound("Gallery not found");
  if (isExpired(g.expiresAt)) {
    throw Errors.forbidden("This gallery link has expired");
  }
}
