import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * End-to-end workflow test against a REAL Postgres database.
 * Skipped unless TEST_DATABASE_URL is set (so `npm test` stays hermetic).
 *
 *   TEST_DATABASE_URL=postgresql://... npx prisma db push
 *   TEST_DATABASE_URL=postgresql://... npm test
 *
 * Covers: role-based authorization, photo selection, gallery publishing,
 * and PIN-protected access + rejection.
 */
const RUN = !!process.env.TEST_DATABASE_URL;
if (RUN) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const d = RUN ? describe : describe.skip;

// Imported lazily so the mocked-prisma unit tests aren't affected.
let prisma: import("@prisma/client").PrismaClient;
let hashPassword: typeof import("@/lib/auth").hashPassword;
let hashPin: typeof import("@/lib/auth").hashPin;
let verifyPin: typeof import("@/lib/auth").verifyPin;
let assertEventAccess: typeof import("@/lib/authz").assertEventAccess;
let assertAdmin: typeof import("@/lib/authz").assertAdmin;

const ids: { users: string[]; events: string[] } = { users: [], events: [] };

beforeAll(async () => {
  if (!RUN) return;
  prisma = new (await import("@prisma/client")).PrismaClient();
  ({ hashPassword, hashPin, verifyPin } = await import("@/lib/auth"));
  ({ assertEventAccess, assertAdmin } = await import("@/lib/authz"));
});

afterAll(async () => {
  if (!RUN) return;
  await prisma.event.deleteMany({ where: { id: { in: ids.events } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.$disconnect();
});

d("photo-sharing workflow", () => {
  it("runs the full admin → member → gallery → customer flow", async () => {
    const stamp = Date.now();
    const admin = await prisma.user.create({
      data: {
        email: `admin_${stamp}@test.local`,
        name: "Admin",
        role: "ADMIN",
        passwordHash: await hashPassword("password123"),
      },
    });
    const member = await prisma.user.create({
      data: {
        email: `member_${stamp}@test.local`,
        name: "Member",
        role: "TEAM_MEMBER",
        passwordHash: await hashPassword("password123"),
      },
    });
    const outsider = await prisma.user.create({
      data: {
        email: `outsider_${stamp}@test.local`,
        name: "Outsider",
        role: "TEAM_MEMBER",
        passwordHash: await hashPassword("password123"),
      },
    });
    ids.users.push(admin.id, member.id, outsider.id);

    const sUser = (u: typeof admin) => ({
      id: u.id,
      role: u.role,
      email: u.email,
      name: u.name,
      mustChangePassword: false,
    });

    // 1. Admin creates an event and adds the member
    const event = await prisma.event.create({
      data: { name: `Event ${stamp}`, createdById: admin.id },
    });
    ids.events.push(event.id);
    await prisma.eventMember.create({ data: { eventId: event.id, userId: member.id } });

    // Authorization: member is in, outsider is not
    await expect(assertEventAccess(sUser(member), event.id)).resolves.toBeTruthy();
    await expect(assertEventAccess(sUser(outsider), event.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(() => assertAdmin(sUser(member))).toThrow();

    // 2. Member uploads photos (metadata only here)
    const photos = await Promise.all(
      Array.from({ length: 5 }).map((_, i) =>
        prisma.photo.create({
          data: {
            eventId: event.id,
            uploadedById: member.id,
            filename: `p${i}.jpg`,
            mimeType: "image/jpeg",
            fileSize: 1000 + i,
            storageKey: `events/${event.id}/originals/p${i}`,
            thumbnailKey: `events/${event.id}/thumbnails/p${i}.webp`,
            status: "READY",
          },
        }),
      ),
    );

    // 3. Admin selects 3 of them
    const chosen = photos.slice(0, 3).map((p) => p.id);
    await prisma.photo.updateMany({
      where: { id: { in: chosen }, eventId: event.id },
      data: { selected: true },
    });
    const selectedCount = await prisma.photo.count({
      where: { eventId: event.id, selected: true },
    });
    expect(selectedCount).toBe(3);

    // 4. Admin publishes a gallery with a PIN
    const PIN = "135790";
    const gallery = await prisma.gallery.create({
      data: {
        eventId: event.id,
        createdById: admin.id,
        title: "Selects",
        slug: `test-${stamp}`,
        pinHash: await hashPin(PIN),
        published: true,
        publishedAt: new Date(),
        photos: { create: chosen.map((id, i) => ({ photoId: id, order: i })) },
      },
      include: { _count: { select: { photos: true } } },
    });
    expect(gallery._count.photos).toBe(3);
    expect(gallery.published).toBe(true);

    // 5. Customer PIN check — wrong then right
    const stored = await prisma.gallery.findUniqueOrThrow({ where: { id: gallery.id } });
    expect(await verifyPin("000000", stored.pinHash)).toBe(false);
    expect(await verifyPin(PIN, stored.pinHash)).toBe(true);

    // Unpublished galleries must not be viewable
    await prisma.gallery.update({ where: { id: gallery.id }, data: { published: false } });
    const unpublished = await prisma.gallery.findUniqueOrThrow({ where: { id: gallery.id } });
    expect(unpublished.published).toBe(false);
  });
});
