import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic route. Runs each suspect subsystem in isolation and
 * reports the first error message + stack. Delete once the deployment is healthy.
 */
export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    const { getEnv } = await import("@/lib/env");
    getEnv();
    steps.getEnv = "ok";
  } catch (e) {
    steps.getEnv = { error: String((e as Error)?.message), stack: (e as Error)?.stack };
  }

  try {
    const { cookies } = await import("next/headers");
    cookies().getAll();
    steps.cookies = "ok";
  } catch (e) {
    steps.cookies = { error: String((e as Error)?.message), stack: (e as Error)?.stack };
  }

  try {
    const { getSessionClaims } = await import("@/lib/session");
    const c = await getSessionClaims();
    steps.getSessionClaims = { ok: true, hasSession: !!c };
  } catch (e) {
    steps.getSessionClaims = { error: String((e as Error)?.message), stack: (e as Error)?.stack };
  }

  try {
    const { getCurrentUser } = await import("@/lib/session");
    const u = await getCurrentUser();
    steps.getCurrentUser = { ok: true, hasUser: !!u };
  } catch (e) {
    steps.getCurrentUser = { error: String((e as Error)?.message), stack: (e as Error)?.stack };
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const n = await prisma.user.count();
    steps.prismaUserCount = n;
  } catch (e) {
    steps.prismaUserCount = { error: String((e as Error)?.message), stack: (e as Error)?.stack };
  }

  steps.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  steps.bucketName = process.env.SUPABASE_STORAGE_BUCKET ?? "(default) event-photos";
  steps.serviceKeyLen = process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0;

  try {
    const { supabaseAdmin, storageBucket } = await import("@/lib/supabase");
    const admin = supabaseAdmin();
    const { data: buckets, error: listErr } = await admin.storage.listBuckets();
    steps.listBuckets = listErr
      ? { error: listErr.message }
      : (buckets ?? []).map((b) => b.name);
    const { data: got, error: getErr } = await admin.storage.getBucket(storageBucket());
    steps.getBucket = getErr ? { error: getErr.message } : { name: got?.name, public: got?.public };
  } catch (e) {
    steps.bucketProbe = { error: String((e as Error)?.message) };
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const { signedUrls } = await import("@/lib/supabase");
    const photo = await prisma.photo.findFirst({
      where: { status: "READY", thumbnailKey: { not: null } },
      select: { thumbnailKey: true },
    });
    if (!photo?.thumbnailKey) {
      steps.storageSign = "no READY photo to test";
    } else {
      const urls = await signedUrls([photo.thumbnailKey], 60);
      steps.storageSign = {
        ok: true,
        key: photo.thumbnailKey,
        gotUrl: Boolean(urls[photo.thumbnailKey]),
      };
    }
  } catch (e) {
    steps.storageSign = { error: String((e as Error)?.message), stack: (e as Error)?.stack };
  }

  return NextResponse.json({ node: process.version, steps });
}
