import { cookies } from "next/headers";
import { getEnv } from "./env";
import { signGalleryAccess, verifyGalleryAccess } from "./auth";
import { Errors } from "./api";

function cookieName(slug: string): string {
  return `${getEnv().GALLERY_COOKIE_PREFIX}${slug}`;
}

export async function grantGalleryAccess(galleryId: string, slug: string): Promise<void> {
  const token = await signGalleryAccess({ gid: galleryId, slug });
  // Path is "/" so the browser also sends it to the `/api/gallery/<slug>/*`
  // routes (a `/gallery/<slug>` path would exclude them). Scoping is still
  // tight: the cookie name carries the slug and the JWT is verified against it.
  cookies().set(cookieName(slug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getEnv().GALLERY_SESSION_TTL_SECONDS,
  });
}

/** Throw 401 unless the caller holds a valid access cookie for this slug. */
export async function requireGalleryAccess(slug: string): Promise<{ galleryId: string }> {
  const token = cookies().get(cookieName(slug))?.value;
  if (!token) throw Errors.unauthorized("Enter the gallery PIN to continue");
  const claims = await verifyGalleryAccess(token, slug);
  if (!claims) throw Errors.unauthorized("Your gallery session has expired — re-enter the PIN");
  return { galleryId: claims.gid };
}

export async function hasGalleryAccess(slug: string): Promise<boolean> {
  const token = cookies().get(cookieName(slug))?.value;
  if (!token) return false;
  return (await verifyGalleryAccess(token, slug)) !== null;
}
