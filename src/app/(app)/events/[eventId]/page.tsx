import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { assertEventAccess } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { EventWorkspace } from "@/components/events/event-workspace";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { eventId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    await assertEventAccess(user, params.eventId);
  } catch {
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      id: true,
      name: true,
      description: true,
      date: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      _count: { select: { photos: true, members: true, galleries: true } },
    },
  });
  if (!event) notFound();

  const selectedCount = await prisma.photo.count({
    where: { eventId: event.id, selected: true, status: "READY" },
  });

  return (
    <div className="space-y-6">
      <Link href="/events" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {event.date ? formatDate(event.date) : `Created ${formatDate(event.createdAt)}`} · by{" "}
          {event.createdBy.name}
        </p>
        {event.description && <p className="mt-2 max-w-2xl text-slate-600">{event.description}</p>}
      </div>

      <EventWorkspace
        eventId={event.id}
        isAdmin={user.role === "ADMIN"}
        counts={{
          photos: event._count.photos,
          members: event._count.members,
          galleries: event._count.galleries,
          selected: selectedCount,
        }}
      />
    </div>
  );
}
