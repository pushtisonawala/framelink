import Link from "next/link";
import { Camera, Users, Lock, CheckCircle2, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <Camera className="h-5 w-5 text-brand-600" />
          FrameLink
        </div>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
              <Link href="/register" className="btn-primary">
                Create team account
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-14 text-center">
        <span className="badge bg-brand-100 text-brand-700">For photography &amp; event teams</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Shoot together. Curate as a lead. Share a private gallery with your client.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Your team uploads every shot from the event. The lead reviews everything in one place and
          selects the keepers. The client opens one link, enters a PIN, and browses the finished
          gallery — no sign-up.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={user ? "/dashboard" : "/register"} className="btn-primary px-5 py-2.5">
            {user ? "Open dashboard" : "Get started"} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="btn-secondary px-5 py-2.5">
            I have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-20 sm:grid-cols-3">
        {[
          {
            icon: Users,
            title: "Collaborative upload",
            body: "Add team members to an event. Each uploads their own photos with drag-and-drop, bulk selection, and per-file progress.",
          },
          {
            icon: CheckCircle2,
            title: "Lead curation",
            body: "The admin sees every upload across the team, filters and searches, then selects the shots that make the final gallery.",
          },
          {
            icon: Lock,
            title: "PIN-protected sharing",
            body: "Publish a gallery to a shareable link secured by a numeric PIN, with optional expiry and downloads. Rate-limited against guessing.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-6">
            <f.icon className="h-6 w-6 text-brand-600" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-sm text-slate-500">
        FrameLink · built for the TrizenAI full-stack take-home
      </footer>
    </main>
  );
}
