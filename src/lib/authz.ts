import { prisma } from "./prisma";
import { Errors } from "./api";
import type { SessionUser } from "./session";

/**
 * Authorization helpers. Every data-access path that depends on "which event"
 * goes through one of these so the rules live in exactly one place.
 */

/** Admins see every event; team members only events they're a member of. */
export async function assertEventAccess(
  user: SessionUser,
  eventId: string,
): Promise<{ isAdmin: boolean; isMember: boolean }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) throw Errors.notFound("Event not found");

  if (user.role === "ADMIN") return { isAdmin: true, isMember: false };

  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    select: { id: true },
  });
  if (!membership) {
    // Do not reveal that the event exists.
    throw Errors.notFound("Event not found");
  }
  return { isAdmin: false, isMember: true };
}

/** Only admins may manage a gallery / selection / members. */
export function assertAdmin(user: SessionUser): void {
  if (user.role !== "ADMIN") {
    throw Errors.forbidden("Only an Admin/Lead can perform this action");
  }
}

/**
 * A team member may only act on (delete) their own photos; admins on any photo
 * within an event.
 */
export async function assertPhotoManage(
  user: SessionUser,
  photoId: string,
): Promise<{ eventId: string }> {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, eventId: true, uploadedById: true },
  });
  if (!photo) throw Errors.notFound("Photo not found");

  await assertEventAccess(user, photo.eventId);

  if (user.role !== "ADMIN" && photo.uploadedById !== user.id) {
    throw Errors.forbidden("You can only manage photos you uploaded");
  }
  return { eventId: photo.eventId };
}
