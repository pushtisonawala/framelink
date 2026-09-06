import { prisma } from "./prisma";
import { getEnv } from "./env";

/**
 * DB-backed sliding-window rate limit for gallery PIN attempts.
 * Keyed on (galleryId, hashed IP). Uses the GalleryAccessLog table so it also
 * doubles as an audit trail — no extra infra (Redis) required for this scale.
 */
export async function checkPinRateLimit(
  galleryId: string,
  ipHash: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const env = getEnv();
  const windowStart = new Date(Date.now() - env.PIN_ATTEMPT_WINDOW_SECONDS * 1000);

  const recentFailures = await prisma.galleryAccessLog.count({
    where: {
      galleryId,
      ipHash,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (recentFailures >= env.PIN_MAX_ATTEMPTS) {
    const oldest = await prisma.galleryAccessLog.findFirst({
      where: { galleryId, ipHash, success: false, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const retryAfterSeconds = oldest
      ? Math.max(
          1,
          Math.ceil(
            (oldest.createdAt.getTime() +
              env.PIN_ATTEMPT_WINDOW_SECONDS * 1000 -
              Date.now()) /
              1000,
          ),
        )
      : env.PIN_ATTEMPT_WINDOW_SECONDS;
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordPinAttempt(params: {
  galleryId: string;
  ipHash: string;
  userAgent?: string | null;
  success: boolean;
}): Promise<void> {
  await prisma.galleryAccessLog.create({
    data: {
      galleryId: params.galleryId,
      ipHash: params.ipHash,
      userAgent: params.userAgent?.slice(0, 400) ?? null,
      success: params.success,
    },
  });
}
