"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ImageOff } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Spinner, EmptyState } from "@/components/ui";
import { Lightbox } from "@/components/events/lightbox";

interface GPhoto {
  id: string;
  filename: string;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
}

export function GalleryView({ slug, allowDownload }: { slug: string; allowDownload: boolean }) {
  const [photos, setPhotos] = useState<GPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (next: string | null) => {
      next ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await api.get<{ photos: GPhoto[]; nextCursor: string | null }>(
          `/api/gallery/${slug}/photos?limit=24${next ? `&cursor=${next}` : ""}`,
        );
        setPhotos((prev) => (next ? [...prev, ...res.photos] : res.photos));
        setCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load photos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  useEffect(() => {
    if (!sentinel.current || !cursor) return;
    const el = sentinel.current;
    const obs = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && !loadingMore && load(cursor),
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadingMore, load]);

  function downloadPhoto(id: string) {
    window.open(`/api/gallery/${slug}/download/${id}`, "_blank");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState icon={ImageOff} title="Couldn't load the gallery" description={error} />
    );
  }

  if (photos.length === 0) {
    return <EmptyState icon={ImageOff} title="This gallery has no photos yet" />;
  }

  return (
    <div>
      <div className="gallery-columns">
        {photos.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-lg bg-slate-100">
            <button onClick={() => setLightboxId(p.id)} className="block w-full" aria-label={`View ${p.filename}`}>
              {p.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbnailUrl}
                  alt={p.filename}
                  loading="lazy"
                  className="w-full transition group-hover:opacity-90"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-slate-400">
                  <ImageOff className="h-6 w-6" />
                </div>
              )}
            </button>
            {allowDownload && (
              <button
                onClick={() => downloadPhoto(p.id)}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-600 opacity-0 shadow transition hover:text-brand-600 group-hover:opacity-100"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div ref={sentinel} />
      {loadingMore && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {lightboxId && (
        <Lightbox
          photos={photos.map((p) => ({ id: p.id, filename: p.filename }))}
          currentId={lightboxId}
          onClose={() => setLightboxId(null)}
          onNavigate={setLightboxId}
          resolveUrl={async (id) => {
            const p = photos.find((x) => x.id === id);
            if (p?.previewUrl) return p.previewUrl;
            throw new Error("No preview");
          }}
          onDownload={allowDownload ? downloadPhoto : undefined}
          footer={(id) => photos.find((p) => p.id === id)?.filename ?? ""}
        />
      )}
    </div>
  );
}
