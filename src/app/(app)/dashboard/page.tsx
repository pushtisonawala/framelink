import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Image as ImageIcon, Users, CheckCircle2, Plus, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "ADMIN";

  const events = await prisma.event.findMany({
    where: isAdmin ? {} : { members: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      name: true,
      date: true,
      createdAt: true,
      _count: { select: { photos: true, members: true, galleries: true } },
    },
  });

  const myUploads = await prisma.photo.count({ where: { uploadedById: user.id } });
  const totals = isAdmin
    ? {
        events: await prisma.event.count(),
        photos: await prisma.photo.count({ where: { status: "READY" } }),
        selected: await prisma.photo.count({ where: { selected: true, status: "READY" } }),
        galleries: await prisma.gallery.count({ where: { published: true } }),
      }
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? "Every event, upload and gallery for your team."
              : "The events you've been added to."}
          </p>
        </div>
        {isAdmin && (
          <Link href="/events?new=1" className="btn-primary">
            <Plus className="h-4 w-4" /> New event
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(isAdmin
          ? [
              { label: "Events", value: totals!.events, icon: CalendarDays },
              { label: "Photos uploaded", value: totals!.photos, icon: ImageIcon },
              { label: "Selected for galleries", value: totals!.selected, icon: CheckCircle2 },
              { label: "Published galleries", value: totals!.galleries, icon: Users },
            ]
          : [
              { label: "My events", value: events.length, icon: CalendarDays },
              { label: "My uploads", value: myUploads, icon: ImageIcon },
            ]
        ).map((s) => (
          <div key={s.label} className="card p-5">
            <s.icon className="h-5 w-5 text-brand-600" />
            <p className="mt-3 text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent events</h2>
          <Link href="/events" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={isAdmin ? "No events yet" : "You haven't been added to an event"}
            description={
              isAdmin
                ? "Create your first event, then add the team members who'll be shooting it."
                : "Once an admin adds you to an event, it'll show up here."
            }
            action={
              isAdmin ? (
                <Link href="/events?new=1" className="btn-primary">
                  <Plus className="h-4 w-4" /> Create event
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`} className="card group p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold group-hover:text-brand-700">{e.name}</h3>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-600" />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {e.date ? formatDate(e.date) : `Created ${formatDate(e.createdAt)}`}
                </p>
                <div className="mt-4 flex gap-4 text-xs text-slate-500">
                  <span>{e._count.photos} photos</span>
                  <span>{e._count.members} members</span>
                  <span>{e._count.galleries} galleries</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
