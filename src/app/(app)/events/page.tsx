import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui";
import { NewEventButton } from "@/components/events/new-event-button";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "ADMIN";

  const events = await prisma.event.findMany({
    where: isAdmin ? {} : { members: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? "All events you manage." : "Events you're a member of."}
          </p>
        </div>
        {isAdmin && <NewEventButton />}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={isAdmin ? "No events yet" : "No events assigned"}
          description={
            isAdmin
              ? "Create an event to start collecting photos from your team."
              : "An admin will add you to events you're shooting."
          }
          action={isAdmin ? <NewEventButton /> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card group p-6 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold group-hover:text-brand-700">{e.name}</h3>
                <span className="shrink-0 text-xs text-slate-400">
                  {e.date ? formatDate(e.date) : formatDate(e.createdAt)}
                </span>
              </div>
              {e.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{e.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>{e._count.photos} photos</span>
                <span>{e._count.members} team members</span>
                <span>{e._count.galleries} galleries</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
