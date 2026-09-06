"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  CheckCircle2,
  Circle,
  Trash2,
  Download,
  Search,
  X,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button, EmptyState, Spinner, Badge } from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";
import { PhotoUploader } from "./photo-uploader";
import { Lightbox } from "./lightbox";

interface Photo {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  status: "PENDING" | "READY" | "FAILED";
  selected: boolean;
  createdAt: string;
  thumbnailUrl: string | null;
  uploadedBy: { id: string; name: string };
}

export function PhotoPanel({
  eventId,
  isAdmin,
  onSelectedChange,
}: {
  eventId: string;
  isAdmin: boolean;
  onSelectedChange: (n: number) => void;
}) {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [filterSelected, setFilterSelected] = useState<"all" | "selected" | "unselected">("all");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const buildQuery = useCallback(
    (next?: string | null) => {
      const p = new URLSearchParams();
      p.set("limit", "30");
      if (next) p.set("cursor", next);
      if (q.trim()) p.set("q", q.trim());
      if (filterSelected === "selected") p.set("selected", "true");
      if (filterSelected === "unselected") p.set("selected", "false");
      return p.toString();
    },
    [q, filterSelected],
  );

  const load = useCallback(
    async (reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await api.get<{ photos: Photo[]; nextCursor: string | null }>(
          `/api/events/${eventId}/photos?${buildQuery(reset ? null : cursor)}`,
        );
        setPhotos((prev) => (reset ? res.photos : [...prev, ...res.photos]));
        setCursor(res.nextCursor);
      } catch (err) {
        toast(err instanceof ApiClientError ? err.message : "Failed to load photos", "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [eventId, buildQuery, cursor, toast],
  );

  // initial + filter changes
  useEffect(() => {
    const t = setTimeout(() => load(true), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterSelected]);

  // infinite scroll
  useEffect(() => {
    if (!sentinel.current || !cursor) return;
    const el = sentinel.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) load(false);
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadingMore, load]);

  async function toggleSelect(ids: string[], selected: boolean) {
    // optimistic
    setPhotos((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, selected } : p)));
    try {
      const res = await api.post<{ selectedCount: number }>(
        `/api/events/${eventId}/photos/select`,
        { photoIds: ids, selected },
      );
      onSelectedChange(res.selectedCount);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Selection failed", "error");
      load(true);
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm("Delete this photo permanently?")) return;
    try {
      await api.del(`/api/photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      toast("Photo deleted", "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Delete failed", "error");
    }
  }

  async function download(id: string) {
    try {
      const { url } = await api.get<{ url: string }>(`/api/photos/${id}/url?download=1`);
      window.open(url, "_blank");
    } catch {
      toast("Could not generate download link", "error");
    }
  }

  const allChecked = photos.length > 0 && checked.size === photos.length;

  return (
    <div className="space-y-5">
      <PhotoUploader eventId={eventId} onUploaded={() => load(true)} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by filename…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {isAdmin && (
          <div className="flex rounded-lg border p-0.5 text-sm">
            {(["all", "selected", "unselected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterSelected(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 capitalize",
                  filterSelected === f ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {isAdmin && checked.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm">
          <span className="font-medium text-brand-800">{checked.size} selected</span>
          <Button
            variant="secondary"
            className="py-1"
            onClick={() => {
              toggleSelect([...checked], true);
              setChecked(new Set());
            }}
          >
            <CheckCircle2 className="h-4 w-4" /> Add to gallery
          </Button>
          <Button
            variant="secondary"
            className="py-1"
            onClick={() => {
              toggleSelect([...checked], false);
              setChecked(new Set());
            }}
          >
            <Circle className="h-4 w-4" /> Remove from gallery
          </Button>
          <button
            onClick={() => setChecked(new Set())}
            className="ml-auto text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        </div>
      )}

      {isAdmin && photos.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) =>
              setChecked(e.target.checked ? new Set(photos.map((p) => p.id)) : new Set())
            }
          />
          Select all on screen
        </label>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : photos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={q || filterSelected !== "all" ? "No photos match" : "No photos yet"}
          description={
            q || filterSelected !== "all"
              ? "Try clearing the search or filter."
              : "Upload photos above to get started."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-slate-100",
                p.selected && "ring-2 ring-brand-500",
              )}
            >
              <button
                className="block aspect-square w-full"
                onClick={() => setLightboxId(p.id)}
                aria-label={`View ${p.filename}`}
              >
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnailUrl}
                    alt={p.filename}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    {p.status === "FAILED" ? "Upload failed" : <Spinner />}
                  </div>
                )}
              </button>

              {isAdmin && (
                <input
                  type="checkbox"
                  className="absolute left-2 top-2 h-4 w-4 rounded"
                  checked={checked.has(p.id)}
                  onChange={(e) => {
                    setChecked((prev) => {
                      const n = new Set(prev);
                      e.target.checked ? n.add(p.id) : n.delete(p.id);
                      return n;
                    });
                  }}
                />
              )}

              {isAdmin && (
                <button
                  onClick={() => toggleSelect([p.id], !p.selected)}
                  className={cn(
                    "absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow transition",
                    p.selected ? "text-brand-600" : "text-slate-400 opacity-0 group-hover:opacity-100",
                  )}
                  title={p.selected ? "Remove from gallery selection" : "Select for gallery"}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                <span className="truncate">{p.uploadedBy.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => download(p.id)} title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deletePhoto(p.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>

              {p.selected && (
                <span className="absolute left-2 bottom-2 opacity-0 group-hover:opacity-0">
                  <Badge color="brand">In gallery</Badge>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div ref={sentinel} />
      {loadingMore && (
        <div className="flex justify-center py-4">
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
            const { url } = await api.get<{ url: string }>(`/api/photos/${id}/url`);
            return url;
          }}
          footer={(id) => {
            const ph = photos.find((p) => p.id === id);
            return ph ? `${ph.filename} · ${formatBytes(ph.fileSize)}` : "";
          }}
        />
      )}
    </div>
  );
}
