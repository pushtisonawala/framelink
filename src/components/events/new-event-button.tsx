"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") setOpen(true);
  }, [params]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const { event } = await api.post<{ event: { id: string } }>("/api/events", {
        name: form.get("name"),
        description: form.get("description") || undefined,
        date: form.get("date") || undefined,
      });
      toast("Event created", "success");
      router.push(`/events/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create event");
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New event
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create event">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Event name" name="name" required placeholder="Arjun & Priya Wedding" />
          <Input label="Event date" name="date" type="date" />
          <Textarea label="Description (optional)" name="description" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function NewEventButton() {
  return (
    <Suspense fallback={<Button><Plus className="h-4 w-4" /> New event</Button>}>
      <Inner />
    </Suspense>
  );
}
