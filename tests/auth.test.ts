import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  signSession,
  verifySession,
  signGalleryAccess,
  verifyGalleryAccess,
  generatePin,
  generateTempPassword,
  hashIp,
} from "@/lib/auth";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toContain("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("PIN hashing", () => {
  it("verifies the right PIN only", async () => {
    const hash = await hashPin("482917");
    expect(await verifyPin("482917", hash)).toBe(true);
    expect(await verifyPin("000000", hash)).toBe(false);
  });
});

describe("session JWT", () => {
  it("round-trips valid claims", async () => {
    const token = await signSession({
      sub: "user_1",
      email: "a@b.com",
      role: "ADMIN",
      name: "A",
    });
    const claims = await verifySession(token);
    expect(claims).toMatchObject({ sub: "user_1", role: "ADMIN", email: "a@b.com" });
  });

  it("rejects a tampered / garbage token", async () => {
    expect(await verifySession("not-a-jwt")).toBeNull();
    const token = await signSession({ sub: "u", email: "e", role: "TEAM_MEMBER", name: "n" });
    expect(await verifySession(token + "x")).toBeNull();
  });
});

describe("gallery access JWT", () => {
  it("is scoped to a single slug", async () => {
    const token = await signGalleryAccess({ gid: "g1", slug: "abc123" });
    expect(await verifyGalleryAccess(token, "abc123")).toMatchObject({ gid: "g1" });
    // a token for one gallery must not unlock another
    expect(await verifyGalleryAccess(token, "different")).toBeNull();
  });
});

describe("generators", () => {
  it("generatePin produces N numeric digits", () => {
    expect(generatePin(6)).toMatch(/^\d{6}$/);
    expect(generatePin(4)).toMatch(/^\d{4}$/);
  });
  it("temp passwords are 10 chars and reasonably unique", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).toHaveLength(10);
    expect(a).not.toEqual(b);
  });
  it("hashIp is stable and does not leak the raw ip", () => {
    const h = hashIp("203.0.113.5");
    expect(h).toHaveLength(64);
    expect(h).not.toContain("203.0.113.5");
    expect(hashIp("203.0.113.5")).toEqual(h);
  });
});
