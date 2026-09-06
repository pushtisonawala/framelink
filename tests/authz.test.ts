import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Authorization rules — the heart of the security model.
 * Prisma is mocked so these run without a database.
 */
const { db } = vi.hoisted(() => ({
  db: {
    event: { findUnique: vi.fn() },
    eventMember: { findUnique: vi.fn() },
    photo: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { assertEventAccess, assertAdmin, assertPhotoManage } from "@/lib/authz";
import { HttpError } from "@/lib/api";

const admin = { id: "a1", role: "ADMIN" as const, email: "", name: "", mustChangePassword: false };
const member = { id: "m1", role: "TEAM_MEMBER" as const, email: "", name: "", mustChangePassword: false };
const other = { id: "m2", role: "TEAM_MEMBER" as const, email: "", name: "", mustChangePassword: false };

beforeEach(() => {
  vi.clearAllMocks();
  db.event.findUnique.mockResolvedValue({ id: "e1" });
});

describe("assertEventAccess", () => {
  it("lets an admin into any existing event", async () => {
    await expect(assertEventAccess(admin, "e1")).resolves.toMatchObject({ isAdmin: true });
    expect(db.eventMember.findUnique).not.toHaveBeenCalled();
  });

  it("lets a member into an event they belong to", async () => {
    db.eventMember.findUnique.mockResolvedValue({ id: "em1" });
    await expect(assertEventAccess(member, "e1")).resolves.toMatchObject({ isMember: true });
  });

  it("hides an event a member is not part of (404, not 403)", async () => {
    db.eventMember.findUnique.mockResolvedValue(null);
    await expect(assertEventAccess(member, "e1")).rejects.toMatchObject({ status: 404 });
  });

  it("404s a missing event", async () => {
    db.event.findUnique.mockResolvedValue(null);
    await expect(assertEventAccess(admin, "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("assertAdmin", () => {
  it("throws 403 for a team member", () => {
    expect(() => assertAdmin(member)).toThrowError(HttpError);
    try {
      assertAdmin(member);
    } catch (e) {
      expect((e as HttpError).status).toBe(403);
    }
  });
  it("passes for an admin", () => {
    expect(() => assertAdmin(admin)).not.toThrow();
  });
});

describe("assertPhotoManage", () => {
  it("lets a member delete their own photo", async () => {
    db.photo.findUnique.mockResolvedValue({ id: "p1", eventId: "e1", uploadedById: "m1" });
    db.eventMember.findUnique.mockResolvedValue({ id: "em1" });
    await expect(assertPhotoManage(member, "p1")).resolves.toMatchObject({ eventId: "e1" });
  });

  it("stops a member from deleting someone else's photo", async () => {
    db.photo.findUnique.mockResolvedValue({ id: "p1", eventId: "e1", uploadedById: "m1" });
    db.eventMember.findUnique.mockResolvedValue({ id: "em1" });
    await expect(assertPhotoManage(other, "p1")).rejects.toMatchObject({ status: 403 });
  });

  it("lets an admin manage any photo in the event", async () => {
    db.photo.findUnique.mockResolvedValue({ id: "p1", eventId: "e1", uploadedById: "m1" });
    await expect(assertPhotoManage(admin, "p1")).resolves.toMatchObject({ eventId: "e1" });
  });
});
