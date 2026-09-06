import { handler, json, parseJson, Errors } from "@/lib/api";
import { verifyPinSchema } from "@/lib/validation";
import { loadGalleryBySlug, assertGalleryViewable } from "@/lib/gallery";
import { grantGalleryAccess } from "@/lib/gallery-session";
import { verifyPin, hashIp } from "@/lib/auth";
import { checkPinRateLimit, recordPinAttempt } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Ctx = { params: { slug: string } };

/** Exchange a correct PIN for a short-lived, slug-scoped access cookie. */
export const POST = handler(async (req, { params }: Ctx) => {
  const { pin } = await parseJson(req, verifyPinSchema);
  const gallery = await loadGalleryBySlug(params.slug);
  assertGalleryViewable(gallery); // 404 if unpublished, 403 if expired

  const ipHash = hashIp(getClientIp(req));
  const userAgent = req.headers.get("user-agent");

  const limit = await checkPinRateLimit(gallery.id, ipHash);
  if (!limit.allowed) {
    const err = Errors.tooManyRequests(
      `Too many incorrect attempts. Try again in ${Math.ceil(
        limit.retryAfterSeconds / 60,
      )} minute(s).`,
    );
    return json(
      { error: { code: err.code, message: err.message } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const ok = await verifyPin(pin, gallery.pinHash);
  await recordPinAttempt({ galleryId: gallery.id, ipHash, userAgent, success: ok });

  if (!ok) throw Errors.unauthorized("Incorrect PIN");

  await grantGalleryAccess(gallery.id, gallery.slug);
  return json({ ok: true });
});
