import { prisma } from "@/lib/prisma";
import { handler, json, Errors } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { assertEventAccess } from "@/lib/authz";
import { getEnv } from "@/lib/env";
import { putObject, deleteObjects, signedUrls } from "@/lib/supabase";
import { processImage } from "@/lib/images";
import { photoKey, thumbKey } from "@/lib/utils";
import { paginationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
// Allow time for multi-file uploads + thumbnailing on serverless.
export const maxDuration = 60;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

type Ctx = { params: { eventId: string } };

/**
 * List photos for an event.
 * - Admin: every photo in the event.
 * - Team member: only the photos they uploaded (unless ?scope=all — still theirs).
 * Supports cursor pagination + search/filter. Returns short-lived signed
 * thumbnail URLs.
 */
export const GET = handler(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const { isAdmin } = await assertEventAccess(user, params.eventId);

  const url = new URL(req.url);
  const { cursor, limit, q, uploadedBy, selected, status } = paginationSchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const where = {
    eventId: params.eventId,
    ...(isAdmin ? {} : { uploadedById: user.id }),
    ...(isAdmin && uploadedBy ? { uploadedById: uploadedBy } : {}),
    ...(selected !== undefined ? { selected } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? { filename: { contains: q, mode: "insensitive" as const } }
      : {}),
  };

  const rows = await prisma.photo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      filename: true,
      mimeType: true,
      fileSize: true,
      width: true,
      height: true,
      status: true,
      selected: true,
      createdAt: true,
      thumbnailKey: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const thumbKeys = page.map((p) => p.thumbnailKey).filter(Boolean) as string[];
  const urls = await signedUrls(thumbKeys, 3600);

  const photos = page.map(({ thumbnailKey, ...p }) => ({
    ...p,
    thumbnailUrl: thumbnailKey ? urls[thumbnailKey] ?? null : null,
  }));

  return json({
    photos,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  });
});

/** Upload one or more photos (multipart/form-data, field name `files`). */
export const POST = handler(async (req, { params }: Ctx) => {
  const user = await requireUser();
  await assertEventAccess(user, params.eventId);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw Errors.badRequest("Expected multipart/form-data");
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw Errors.badRequest("No files provided");
  if (files.length > 50) throw Errors.badRequest("Upload at most 50 files per request");

  const maxBytes = getEnv().MAX_UPLOAD_MB * 1024 * 1024;

  const results = await Promise.all(
    files.map(async (file) => {
      const base = { filename: file.name || "upload", size: file.size };
      try {
        if (!ALLOWED.has(file.type)) {
          return { ...base, ok: false as const, error: "Unsupported file type" };
        }
        if (file.size <= 0) {
          return { ...base, ok: false as const, error: "Empty file" };
        }
        if (file.size > maxBytes) {
          return {
            ...base,
            ok: false as const,
            error: `Exceeds ${getEnv().MAX_UPLOAD_MB} MB limit`,
          };
        }

        const photo = await prisma.photo.create({
          data: {
            eventId: params.eventId,
            uploadedById: user.id,
            filename: file.name || "upload",
            mimeType: file.type,
            fileSize: file.size,
            storageKey: "", // set below
            status: "PENDING",
          },
        });

        const key = photoKey(params.eventId, photo.id, file.name || "upload");
        const buffer = Buffer.from(await file.arrayBuffer());

        try {
          await putObject(key, buffer, file.type);

          let width: number | null = null;
          let height: number | null = null;
          let tKey: string | null = null;
          try {
            const processed = await processImage(buffer);
            tKey = thumbKey(params.eventId, photo.id);
            await putObject(tKey, processed.thumbnail, "image/webp");
            width = processed.width;
            height = processed.height;
          } catch (thumbErr) {
            console.warn("[upload] thumbnail failed for", photo.id, thumbErr);
          }

          const updated = await prisma.photo.update({
            where: { id: photo.id },
            data: {
              storageKey: key,
              thumbnailKey: tKey,
              width,
              height,
              status: "READY",
            },
            select: { id: true, filename: true, status: true, createdAt: true },
          });
          return { ...base, ok: true as const, photo: updated };
        } catch (uploadErr) {
          console.error("[upload] storage failed for", photo.id, uploadErr);
          await prisma.photo
            .update({ where: { id: photo.id }, data: { status: "FAILED" } })
            .catch(() => {});
          await deleteObjects([key]).catch(() => {});
          return { ...base, ok: false as const, error: "Storage upload failed" };
        }
      } catch (err) {
        console.error("[upload] unexpected error", err);
        return { ...base, ok: false as const, error: "Upload failed" };
      }
    }),
  );

  const uploaded = results.filter((r) => r.ok).length;
  const failed = results.length - uploaded;

  return json(
    { uploaded, failed, results },
    { status: failed === 0 ? 201 : 207 },
  );
});
