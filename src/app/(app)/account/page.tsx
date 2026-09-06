"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

function AccountForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const first = params.get("first") === "1";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (form.get("newPassword") !== form.get("confirm")) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
      });
      toast("Password updated", "success");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Account settings</h1>
      {first && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Set a personal password to replace the temporary one you were given.
        </p>
      )}
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        <Input
          label={first ? "Temporary password" : "Current password"}
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
        <Input
          label="New password"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input label="Confirm new password" name="confirm" type="password" required minLength={8} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Update password
        </Button>
      </form>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountForm />
    </Suspense>
  );
}
