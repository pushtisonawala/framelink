import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, LayoutGrid, CalendarDays } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { Badge } from "@/components/ui";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Camera className="h-5 w-5 text-brand-600" />
              FrameLink
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <Link href="/dashboard" className="btn-ghost">
                <LayoutGrid className="h-4 w-4" /> Dashboard
              </Link>
              <Link href="/events" className="btn-ghost">
                <CalendarDays className="h-4 w-4" /> Events
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Badge color={user.role === "ADMIN" ? "brand" : "slate"}>
              {user.role === "ADMIN" ? "Admin / Lead" : "Team member"}
            </Badge>
            <UserMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {user.mustChangePassword && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You&apos;re using a temporary password.{" "}
            <Link href="/account" className="font-medium underline">
              Set a new password
            </Link>
            .
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
