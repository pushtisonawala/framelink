"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { api } from "@/lib/api-client";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[120px] truncate sm:block">{name}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-white p-1 shadow-lg">
            <div className="px-3 py-2 text-xs text-slate-500">{email}</div>
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              <UserIcon className="h-4 w-4" /> Account settings
            </Link>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
