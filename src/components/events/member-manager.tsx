"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Copy, Users } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button, Input, EmptyState, Spinner, Badge } from "@/components/ui";
import { Modal } from "@/components/ui/modal";

interface Member {
  addedAt: string;
  user: { id: string; name: string; email: string; role: string };
}

export function MemberManager({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ members: Member[] }>(`/api/events/${eventId}/members`);
      setMembers(res.members);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load members", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function addMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await api.post<{
        member: Member["user"];
        tempPassword: string | null;
      }>(`/api/events/${eventId}/members`, {
        email: form.get("email"),
        name: form.get("name") || undefined,
      });
      toast("Team member added", "success");
      setOpen(false);
      if (res.tempPassword) {
        setCredentials({ email: res.member.email, tempPassword: res.tempPassword });
      }
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to add member");
    } finally {
      setAdding(false);
    }
  }

  async function remove(userId: string) {
    if (!confirm("Remove this member from the event?")) return;
    try {
      await api.del(`/api/events/${eventId}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
      toast("Member removed", "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to remove", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {isAdmin
            ? "Team members can upload and view their own photos for this event."
            : "People working on this event."}
        </p>
        {isAdmin && (
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add member
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-7 w-7" />
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet"
          description={isAdmin ? "Add the photographers who'll upload to this event." : undefined}
        />
      ) : (
        <div className="card divide-y">
          {members.map((m) => (
            <div key={m.user.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                {m.user.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{m.user.name}</p>
                <p className="text-xs text-slate-500">{m.user.email}</p>
              </div>
              <Badge color={m.user.role === "ADMIN" ? "brand" : "slate"}>
                {m.user.role === "ADMIN" ? "Admin" : "Member"}
              </Badge>
              {isAdmin && m.user.role !== "ADMIN" && (
                <button
                  onClick={() => remove(m.user.id)}
                  className="text-slate-400 hover:text-red-600"
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add team member">
        <form onSubmit={addMember} className="space-y-4">
          <Input label="Email" name="email" type="email" required placeholder="photographer@studio.com" />
          <Input label="Name (optional)" name="name" placeholder="Used if this is a new account" />
          <p className="text-xs text-slate-500">
            If the email isn&apos;t registered yet, a team-member account is created and a one-time
            password is shown here once for you to share.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={adding}>
              Add member
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="One-time password"
      >
        {credentials && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Share these with <strong>{credentials.email}</strong>. They&apos;ll be asked to set
              their own password on first login. This password won&apos;t be shown again.
            </p>
            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3 font-mono text-sm">
              <span>{credentials.tempPassword}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(credentials.tempPassword);
                  toast("Copied", "success");
                }}
                className="text-slate-500 hover:text-slate-800"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => setCredentials(null)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
