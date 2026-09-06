"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { cn, formatBytes } from "@/lib/utils";

interface UploadItem {
  name: string;
  size: number;
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const BATCH = 8;

export function PhotoUploader({
  eventId,
  onUploaded,
}: {
  eventId: string;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      const initial: UploadItem[] = files.map((f) => ({
        name: f.name,
        size: f.size,
        state: "queued",
      }));
      setItems(initial);

      let done = 0;
      let failed = 0;

      for (let i = 0; i < files.length; i += BATCH) {
        const chunk = files.slice(i, i + BATCH);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx >= i && idx < i + BATCH ? { ...it, state: "uploading" } : it,
          ),
        );
        const form = new FormData();
        chunk.forEach((f) => form.append("files", f));
        try {
          const res = await api.upload<{
            results: { filename: string; ok: boolean; error?: string }[];
          }>(`/api/events/${eventId}/photos`, form);
          setItems((prev) =>
            prev.map((it, idx) => {
              if (idx < i || idx >= i + BATCH) return it;
              const r = res.results[idx - i];
              if (r?.ok) {
                done++;
                return { ...it, state: "done" };
              }
              failed++;
              return { ...it, state: "error", error: r?.error ?? "Failed" };
            }),
          );
        } catch (err) {
          failed += chunk.length;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx >= i && idx < i + BATCH
                ? {
                    ...it,
                    state: "error",
                    error: err instanceof ApiClientError ? err.message : "Upload failed",
                  }
                : it,
            ),
          );
        }
      }

      setBusy(false);
      if (done) toast(`${done} photo${done > 1 ? "s" : ""} uploaded`, "success");
      if (failed) toast(`${failed} upload${failed > 1 ? "s" : ""} failed`, "error");
      onUploaded();
      setTimeout(() => setItems([]), failed ? 8000 : 2500);
    },
    [eventId, onUploaded, toast],
  );

  function pick(list: FileList | null) {
    if (!list) return;
    upload(Array.from(list));
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400 hover:bg-slate-50",
        )}
      >
        <UploadCloud className="h-8 w-8 text-brand-500" />
        <p className="text-sm font-medium">
          Drop photos here or <span className="text-brand-600">browse</span>
        </p>
        <p className="text-xs text-slate-400">
          JPEG, PNG, WebP, AVIF or GIF · up to 50 at a time
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-lg border bg-white p-2 text-sm">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1">
              {it.state === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {it.state === "error" && <XCircle className="h-4 w-4 text-red-600" />}
              {(it.state === "uploading" || it.state === "queued") && (
                <Loader2 className={cn("h-4 w-4 text-slate-400", it.state === "uploading" && "animate-spin")} />
              )}
              <span className="flex-1 truncate">{it.name}</span>
              <span className="text-xs text-slate-400">{formatBytes(it.size)}</span>
              {it.error && <span className="text-xs text-red-600">{it.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
