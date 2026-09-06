import { prisma } from "@/lib/prisma";
import { handler, json } from "@/lib/api";
import { loadGalleryBySlug, assertGalleryViewable } from "@/lib/gallery";
import { requireGalleryAccess } from "@/lib/gallery-session";
import { signedUrls } from "@/lib/supabase";
import { paginationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: { slug: string } };

/**
 * Paginated photos for an unlocked, published gallery.
 * Requires a valid gallery access cookie (obtained via /verify).
 * Returns short-lived signed thumbnail + preview URLs — never raw object keys.
 */
export const GET = handler(async (req, { params }: Ctx) => {
  const gallery = await loadGalleryBySlug(params.slug);
  assertGalleryViewable(gallery);
  await requireGalleryAccess(params.slug);

  const { cursor, limit } = paginationSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );

  const rows = await prisma.galleryPhoto.findMany({
    where: { galleryId: gallery.id },
    orderBy: { order: "asc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      order: true,
      photo: {
        select: {
          id: true,
          filename: true,
          width: true,
          height: true,
          storageKey: true,
          thumbnailKey: true,
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const keys = page.flatMap((r) =>
    [r.photo.thumbnailKey, r.photo.storageKey].filter(Boolean),
  ) as string[];
  const urls = await signedUrls(keys, 3600);

  const photos = page.map((r) => ({
    id: r.photo.id,
    filename: r.photo.filename,
    width: r.photo.width,
    height: r.photo.height,
    thumbnailUrl: r.photo.thumbnailKey ? urls[r.photo.thumbnailKey] ?? null : null,
    previewUrl: urls[r.photo.storageKey] ?? null,
  }));

  return json({
    photos,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
    allowDownload: gallery.allowDownload,
  });
});
