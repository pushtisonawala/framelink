"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Spinner } from "@/components/ui";

export function Lightbox({
  photos,
  currentId,
  onClose,
  onNavigate,
  resolveUrl,
  footer,
  onDownload,
}: {
  photos: { id: string; filename: string }[];
  currentId: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
  resolveUrl: (id: string) => Promise<string>;
  footer?: (id: string) => string;
  onDownload?: (id: string) => void;
}) {
  const idx = photos.findIndex((p) => p.id === currentId);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setUrl(null);
    resolveUrl(currentId)
      .then((u) => alive && setUrl(u))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [currentId, resolveUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) onNavigate(photos[idx - 1]!.id);
      if (e.key === "ArrowRight" && idx < photos.length - 1) onNavigate(photos[idx + 1]!.id);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [idx, photos, onClose, onNavigate]);

  if (idx === -1) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm text-white/70">
          {idx + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-3">
          {onDownload && (
            <button onClick={() => onDownload(currentId)} className="rounded p-1 hover:bg-white/10">
              <Download className="h-5 w-5" />
            </button>
          )}
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {idx > 0 && (
          <button
            onClick={() => onNavigate(photos[idx - 1]!.id)}
            className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {loading || !url ? (
          <Spinner className="h-10 w-10 text-white/50" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={photos[idx]!.filename} className="max-h-full max-w-full object-contain" />
        )}
        {idx < photos.length - 1 && (
          <button
            onClick={() => onNavigate(photos[idx + 1]!.id)}
            className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {footer && (
        <div className="p-4 text-center text-sm text-white/60" onClick={(e) => e.stopPropagation()}>
          {footer(currentId)}
        </div>
      )}
    </div>
  );
}
