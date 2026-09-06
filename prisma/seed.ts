/**
 * Seed script — creates demo users, an event, generated photos, and a published
 * gallery so the app is immediately explorable. Safe to run multiple times
 * (upserts users; skips photo generation if the event already has photos).
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { hashPassword, hashPin } from "../src/lib/auth";
import { ensureBucket, putObject } from "../src/lib/supabase";
import { photoKey, thumbKey, newGallerySlug } from "../src/lib/utils";
import { processImage } from "../src/lib/images";

const prisma = new PrismaClient();

const DEMO = {
  admin: { email: "admin@framelink.demo", name: "Priya (Lead)", password: "AdminDemo123!" },
  members: [
    { email: "sam@framelink.demo", name: "Sam Rivera", password: "MemberDemo123!" },
    { email: "kavya@framelink.demo", name: "Kavya Nair", password: "MemberDemo123!" },
  ],
  event: { name: "Arjun & Priya Wedding", description: "Full-day wedding coverage — ceremony, portraits, reception." },
  gallery: { title: "Arjun & Priya — Client Selects", pin: "482917" },
  photoCount: Number(process.env.SEED_PHOTO_COUNT ?? 24),
};

const PALETTES = [
  ["#1e3a8a", "#9333ea"],
  ["#0f766e", "#65a30d"],
  ["#be123c", "#f59e0b"],
  ["#4338ca", "#db2777"],
  ["#0369a1", "#14b8a6"],
  ["#7c2d12", "#eab308"],
];

async function makeImage(label: string, i: number): Promise<Buffer> {
  const [a, b] = PALETTES[i % PALETTES.length]!;
  const w = 1600;
  const h = 1067;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${(i * 137) % w}" cy="${(i * 89) % h}" r="220" fill="#ffffff22"/>
    <circle cx="${(i * 211) % w}" cy="${(i * 53) % h}" r="140" fill="#00000022"/>
    <text x="50%" y="50%" font-family="sans-serif" font-size="64" fill="#ffffffcc"
      text-anchor="middle" dominant-baseline="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  console.log("→ ensuring storage bucket");
  await ensureBucket();

  console.log("→ upserting users");
  const admin = await prisma.user.upsert({
    where: { email: DEMO.admin.email },
    update: {},
    create: {
      email: DEMO.admin.email,
      name: DEMO.admin.name,
      role: "ADMIN",
      passwordHash: await hashPassword(DEMO.admin.password),
    },
  });

  const memberRecords = [];
  for (const m of DEMO.members) {
    const rec = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        name: m.name,
        role: "TEAM_MEMBER",
        passwordHash: await hashPassword(m.password),
      },
    });
    memberRecords.push(rec);
  }

  console.log("→ creating event");
  let event = await prisma.event.findFirst({ where: { name: DEMO.event.name } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: DEMO.event.name,
        description: DEMO.event.description,
        date: new Date(),
        createdById: admin.id,
      },
    });
  }

  for (const m of memberRecords) {
    await prisma.eventMember.upsert({
      where: { eventId_userId: { eventId: event.id, userId: m.id } },
      update: {},
      create: { eventId: event.id, userId: m.id },
    });
  }

  const existingPhotos = await prisma.photo.count({ where: { eventId: event.id } });
  if (existingPhotos === 0) {
    console.log(`→ generating ${DEMO.photoCount} demo photos (uploading to storage)`);
    for (let i = 0; i < DEMO.photoCount; i++) {
      const uploader = i % 3 === 0 ? admin : memberRecords[i % memberRecords.length]!;
      const filename = `wedding_${String(i + 1).padStart(4, "0")}.jpg`;
      const buffer = await makeImage(`Frame ${i + 1}`, i);

      const photo = await prisma.photo.create({
        data: {
          eventId: event.id,
          uploadedById: uploader.id,
          filename,
          mimeType: "image/jpeg",
          fileSize: buffer.length,
          storageKey: "",
          status: "PENDING",
        },
      });
      const key = photoKey(event.id, photo.id, filename);
      await putObject(key, buffer, "image/jpeg");
      const processed = await processImage(buffer);
      const tKey = thumbKey(event.id, photo.id);
      await putObject(tKey, processed.thumbnail, "image/webp");

      await prisma.photo.update({
        where: { id: photo.id },
        data: {
          storageKey: key,
          thumbnailKey: tKey,
          width: processed.width,
          height: processed.height,
          status: "READY",
          selected: i % 5 !== 0, // ~80% selected
        },
      });
      process.stdout.write(`\r   uploaded ${i + 1}/${DEMO.photoCount}`);
    }
    process.stdout.write("\n");
  } else {
    console.log(`→ event already has ${existingPhotos} photos, skipping generation`);
  }

  console.log("→ publishing gallery");
  let gallery = await prisma.gallery.findFirst({ where: { eventId: event.id } });
  if (!gallery) {
    const selected = await prisma.photo.findMany({
      where: { eventId: event.id, selected: true, status: "READY" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    gallery = await prisma.gallery.create({
      data: {
        eventId: event.id,
        createdById: admin.id,
        title: DEMO.gallery.title,
        slug: newGallerySlug(),
        pinHash: await hashPin(DEMO.gallery.pin),
        published: true,
        publishedAt: new Date(),
        allowDownload: true,
        photos: { create: selected.map((p, idx) => ({ photoId: p.id, order: idx })) },
      },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log("\n─────────────────────────────────────────────");
  console.log("  Demo data ready");
  console.log("─────────────────────────────────────────────");
  console.log(`  Admin login     : ${DEMO.admin.email} / ${DEMO.admin.password}`);
  DEMO.members.forEach((m) => console.log(`  Team member     : ${m.email} / ${m.password}`));
  console.log(`  Gallery URL     : ${appUrl}/gallery/${gallery.slug}`);
  console.log(`  Gallery PIN     : ${DEMO.gallery.pin}`);
  console.log("─────────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
