import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  createGallerySchema,
  verifyPinSchema,
  selectPhotosSchema,
  registerUploadSchema,
} from "@/lib/validation";

describe("registerSchema", () => {
  it("normalises email and enforces password length", () => {
    const parsed = registerSchema.parse({
      name: "  Priya ",
      email: "Priya@Example.COM",
      password: "longenough",
    });
    expect(parsed.email).toBe("priya@example.com");
    expect(parsed.name).toBe("Priya");
    expect(() =>
      registerSchema.parse({ name: "x", email: "a@b.com", password: "short" }),
    ).toThrow();
  });
});

describe("loginSchema", () => {
  it("rejects an invalid email", () => {
    expect(() => loginSchema.parse({ email: "nope", password: "x" })).toThrow();
  });
});

describe("createGallerySchema", () => {
  it("requires at least one photo id", () => {
    expect(() =>
      createGallerySchema.parse({ title: "T", photoIds: [] }),
    ).toThrow();
  });
  it("accepts a 4–8 digit PIN and rejects others", () => {
    expect(createGallerySchema.parse({ title: "T", photoIds: ["p1"], pin: "1234" }).pin).toBe("1234");
    expect(() =>
      createGallerySchema.parse({ title: "T", photoIds: ["p1"], pin: "12" }),
    ).toThrow();
    expect(() =>
      createGallerySchema.parse({ title: "T", photoIds: ["p1"], pin: "abcd" }),
    ).toThrow();
  });
  it("defaults publish + allowDownload to true", () => {
    const g = createGallerySchema.parse({ title: "T", photoIds: ["p1"] });
    expect(g.publish).toBe(true);
    expect(g.allowDownload).toBe(true);
  });
});

describe("verifyPinSchema", () => {
  it("trims and bounds the pin", () => {
    expect(verifyPinSchema.parse({ pin: " 482917 " }).pin).toBe("482917");
    expect(() => verifyPinSchema.parse({ pin: "x".repeat(20) })).toThrow();
  });
});

describe("selectPhotosSchema", () => {
  it("needs a boolean selected flag and non-empty ids", () => {
    expect(selectPhotosSchema.parse({ photoIds: ["a"], selected: true }).selected).toBe(true);
    expect(() => selectPhotosSchema.parse({ photoIds: [], selected: true })).toThrow();
  });
});

describe("registerUploadSchema", () => {
  it("only allows image mime types", () => {
    expect(() =>
      registerUploadSchema.parse({ filename: "a.txt", mimeType: "text/plain", fileSize: 1 }),
    ).toThrow();
    expect(
      registerUploadSchema.parse({ filename: "a.jpg", mimeType: "image/jpeg", fileSize: 10 }),
    ).toBeTruthy();
  });
});
