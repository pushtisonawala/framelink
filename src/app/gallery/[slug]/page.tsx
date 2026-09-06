import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Camera, Clock } from "lucide-react";
import { loadGalleryBySlug, isExpired } from "@/lib/gallery";
import { hasGalleryAccess } from "@/lib/gallery-session";
import { GalleryView } from "@/components/gallery/gallery-view";
import { PinGate } from "@/components/gallery/pin-gate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const g = await loadGalleryBySlug(params.slug);
    if (!g.published) return { title: "Gallery" };
    return {
      title: g.title,
      description: `${g.event.name} — a private photo gallery. Enter your PIN to view.`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Gallery" };
  }
}

export default async function PublicGalleryPage({ params }: { params: { slug: string } }) {
  let gallery;
  try {
    gallery = await loadGalleryBySlug(params.slug);
  } catch {
    notFound();
  }

  if (!gallery.published) notFound();

  const expired = isExpired(gallery.expiresAt);
  const unlocked = !expired && (await hasGalleryAccess(params.slug));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-4">
          <Camera className="h-5 w-5 text-brand-600" />
          <span className="font-semibold">FrameLink</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">
          {gallery.event.name}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{gallery.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {gallery._count.photos} photo{gallery._count.photos === 1 ? "" : "s"}
        </p>

        <div className="mt-8">
          {expired ? (
            <div className="card mx-auto max-w-md p-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="mt-3 font-semibold">This gallery link has expired</h2>
              <p className="mt-1 text-sm text-slate-500">
                Please contact your photographer for an updated link.
              </p>
            </div>
          ) : unlocked ? (
            <GalleryView slug={params.slug} allowDownload={gallery.allowDownload} />
          ) : (
            <PinGate slug={params.slug} />
          )}
        </div>
      </div>
    </div>
  );
}
