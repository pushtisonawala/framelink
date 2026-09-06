"use client";

import { useState } from "react";
import { Image as ImageIcon, Users, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhotoPanel } from "./photo-panel";
import { MemberManager } from "./member-manager";
import { GalleryManager } from "./gallery-manager";

type Tab = "photos" | "members" | "galleries";

export function EventWorkspace({
  eventId,
  isAdmin,
  counts,
}: {
  eventId: string;
  isAdmin: boolean;
  counts: { photos: number; members: number; galleries: number; selected: number };
}) {
  const [tab, setTab] = useState<Tab>("photos");
  const [selected, setSelected] = useState(counts.selected);

  const tabs: { id: Tab; label: string; icon: typeof ImageIcon; show: boolean }[] = [
    { id: "photos", label: "Photos", icon: ImageIcon, show: true },
    { id: "members", label: "Team members", icon: Users, show: true },
    { id: "galleries", label: "Galleries", icon: Share2, show: isAdmin },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === "photos" && isAdmin && selected > 0 && (
                <span className="badge bg-brand-100 text-brand-700">{selected} selected</span>
              )}
            </button>
          ))}
      </div>

      <div className="pt-6">
        {tab === "photos" && (
          <PhotoPanel eventId={eventId} isAdmin={isAdmin} onSelectedChange={setSelected} />
        )}
        {tab === "members" && <MemberManager eventId={eventId} isAdmin={isAdmin} />}
        {tab === "galleries" && isAdmin && <GalleryManager eventId={eventId} />}
      </div>
    </div>
  );
}
