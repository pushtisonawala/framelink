"use client";

import { useEffect, useState } from "react";
import {
  Share2,
  Plus,
  Copy,
  ExternalLink,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button, Input, EmptyState, Spinner, Badge } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";

interface Gallery {
  id: string;
  title: string;
  slug: string;
  url: string;
  published: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  allowDownload: boolean;
  createdAt: string;
  _count: { photos: number };
}

export function GalleryManager({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; pin: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [g, photos] = await Promise.all([
        api.get<{ galleries: Gallery[] }>(`/api/events/${eventId}/galleries`),
        api.get<{ photos: unknown[] }>(`/api/events/${eventId}/photos?selected=true&limit=1`),
      ]);
      setGalleries(g.galleries);
      // selectedCount comes from the event endpoint for accuracy
      const ev = await api.get<{ event: { selectedCount: number } }>(`/api/events/${eventId}`);
      setSelectedCount(ev.event.selectedCount);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load galleries", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function createGallery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const pin = (form.get("pin") as string)?.trim();
    const expiresAt = (form.get("expiresAt") as string)?.trim();
    try {
      // pull all currently-selected photo ids
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        const res: { photos: { id: string }[]; nextCursor: string | null } = await api.get(
          `/api/events/${eventId}/photos?selected=true&limit=100${cursor ? `&cursor=${cursor}` : ""}`,
        );
        ids.push(...res.photos.map((p) => p.id));
        cursor = res.nextCursor;
      } while (cursor);

      if (ids.length === 0) {
        setError("Select some photos in the Photos tab first.");
        setCreating(false);
        return;
      }

      const res = await api.post<{ gallery: { url: string }; pin: string }>(
        `/api/events/${eventId}/galleries`,
        {
          title: form.get("title"),
          photoIds: ids,
          pin: pin || undefined,
          allowDownload: form.get("allowDownload") === "on",
          expiresAt: expiresAt || undefined,
          publish: true,
        },
      );
      setOpen(false);
      setResult({ url: res.gallery.url, pin: res.pin });
      toast("Gallery published", "success");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create gallery");
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(g: Gallery) {
    try {
      await api.patch(`/api/galleries/${g.id}`, { published: !g.published });
      toast(g.published ? "Gallery unpublished" : "Gallery published", "success");
      load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Update failed", "error");
    }
  }

  async function rotatePin(g: Gallery) {
    if (!confirm("Generate a new PIN? The old PIN stops working immediately.")) return;
    try {
      const res = await api.patch<{ pin: string; gallery: { url: string } }>(
        `/api/galleries/${g.id}`,
        { rotatePin: true },
      );
      setResult({ url: res.gallery.url, pin: res.pin });
      toast("New PIN generated", "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed", "error");
    }
  }

  async function remove(g: Gallery) {
    if (!confirm(`Delete the gallery "${g.title}"? The share link stops working.`)) return;
    try {
      await api.del(`/api/galleries/${g.id}`);
      setGalleries((prev) => prev.filter((x) => x.id !== g.id));
      toast("Gallery deleted", "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Delete failed", "error");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {selectedCount > 0 ? (
            <>
              <strong className="text-slate-700">{selectedCount}</strong> photo
              {selectedCount > 1 ? "s" : ""} currently selected for publishing.
            </>
          ) : (
            "Select photos in the Photos tab, then publish them as a client gallery."
          )}
        </p>
        <Button onClick={() => setOpen(true)} disabled={selectedCount === 0}>
          <Plus className="h-4 w-4" /> Publish gallery
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-7 w-7" />
        </div>
      ) : galleries.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No galleries published"
          description="Curate a selection, then publish it here to get a shareable PIN-protected link."
        />
      ) : (
        <div className="space-y-3">
          {galleries.map((g) => (
            <div key={g.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{g.title}</h3>
                    <Badge color={g.published ? "green" : "slate"}>
                      {g.published ? "Published" : "Draft"}
                    </Badge>
                    {g.expiresAt && (
                      <Badge color={new Date(g.expiresAt) < new Date() ? "red" : "amber"}>
                        <Clock className="mr-1 h-3 w-3" />
                        {new Date(g.expiresAt) < new Date() ? "Expired" : `Expires ${formatDate(g.expiresAt)}`}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {g._count.photos} photos · created {formatDate(g.createdAt)}
                    {g.allowDownload ? " · downloads on" : " · downloads off"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => togglePublish(g)} className="btn-ghost py-1.5" title="Toggle publish">
                    {g.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => rotatePin(g)} className="btn-ghost py-1.5" title="New PIN">
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <a href={g.url} target="_blank" rel="noreferrer" className="btn-ghost py-1.5" title="Open">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button onClick={() => remove(g)} className="btn-ghost py-1.5 text-red-500" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
                <code className="flex-1 truncate text-slate-600">{g.url}</code>
                <button onClick={() => copy(g.url)} className="text-slate-500 hover:text-slate-800">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Publish client gallery">
        <form onSubmit={createGallery} className="space-y-4">
          <Input label="Gallery title" name="title" required placeholder="Arjun & Priya — Final Selects" />
          <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {selectedCount} selected photo{selectedCount > 1 ? "s" : ""} will be included.
          </div>
          <Input
            label="PIN (optional — leave blank to auto-generate 6 digits)"
            name="pin"
            inputMode="numeric"
            pattern="\d{4,8}"
            placeholder="e.g. 482917"
          />
          <Input label="Link expiry (optional)" name="expiresAt" type="date" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowDownload" defaultChecked /> Allow customers to download
            originals
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Publish
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!result} onClose={() => setResult(null)} title="Gallery ready to share">
        {result && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Send both the link and the PIN to your client. The PIN is shown once — store it now.
            </p>
            <div>
              <p className="label">Gallery link</p>
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
                <code className="flex-1 truncate">{result.url}</code>
                <button onClick={() => copy(result.url)} className="text-slate-500 hover:text-slate-800">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <p className="label">Access PIN</p>
              <div className="flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 font-mono text-lg tracking-[0.3em] text-white">
                <span>{result.pin}</span>
                <button onClick={() => copy(result.pin)} className="text-white/70 hover:text-white">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button onClick={() => setResult(null)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
