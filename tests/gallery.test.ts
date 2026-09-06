import { describe, it, expect, vi, beforeEach } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    gallery: { findUnique: vi.fn() },
    galleryAccessLog: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { loadGalleryBySlug, isExpired, assertGalleryViewable } from "@/lib/gallery";
import { checkPinRateLimit } from "@/lib/rate-limit";

beforeEach(() => vi.clearAllMocks());

function gallery(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    slug: "abc123",
    title: "T",
    pinHash: "hash",
    published: true,
    publishedAt: new Date(),
    expiresAt: null,
    allowDownload: true,
    event: { name: "E" },
    _count: { photos: 3 },
    ...overrides,
  };
}

describe("isExpired", () => {
  it("is false when no expiry set", () => {
    expect(isExpired(null)).toBe(false);
  });
  it("is true for a past date", () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
  });
  it("is false for a future date", () => {
    expect(isExpired(new Date(Date.now() + 100000))).toBe(false);
  });
});

describe("loadGalleryBySlug", () => {
  it("404s an unknown slug", async () => {
    db.gallery.findUnique.mockResolvedValue(null);
    await expect(loadGalleryBySlug("nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("assertGalleryViewable", () => {
  it("404s an unpublished gallery (existence not leaked)", () => {
    expect(() => assertGalleryViewable(gallery({ published: false }) as never)).toThrowError();
    try {
      assertGalleryViewable(gallery({ published: false }) as never);
    } catch (e) {
      expect((e as { status: number }).status).toBe(404);
    }
  });

  it("403s an expired gallery", () => {
    try {
      assertGalleryViewable(gallery({ expiresAt: new Date(Date.now() - 1) }) as never);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as { status: number }).status).toBe(403);
    }
  });

  it("passes a published, unexpired gallery", () => {
    expect(() => assertGalleryViewable(gallery() as never)).not.toThrow();
  });
});

describe("checkPinRateLimit", () => {
  it("allows attempts below the threshold", async () => {
    db.galleryAccessLog.count.mockResolvedValue(3);
    const res = await checkPinRateLimit("g1", "iphash");
    expect(res.allowed).toBe(true);
  });

  it("blocks once too many recent failures exist and reports a retry delay", async () => {
    db.galleryAccessLog.count.mockResolvedValue(10);
    db.galleryAccessLog.findFirst.mockResolvedValue({ createdAt: new Date() });
    const res = await checkPinRateLimit("g1", "iphash");
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });
});
