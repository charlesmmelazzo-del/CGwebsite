"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink, Loader2, Users, GlassWater } from "lucide-react";
import type { PopupMenu, PopupStatus } from "@/lib/popup/types";

type MenuRow = PopupMenu & { cocktailCount: number; voterCount: number };

const STATUS_STYLE: Record<PopupStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-green-100 text-green-700" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700" },
  draft: { label: "Draft", className: "bg-gray-100 text-gray-500" },
  archived: { label: "Archived", className: "bg-amber-50 text-amber-700" },
};

function formatWhen(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPopupListPage() {
  const router = useRouter();
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/popup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load pop-ups.");
      setMenus(data.menus ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load pop-ups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const live = menus.find((m) => m.status === "live");

  return (
    <div className="max-w-5xl">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg text-gray-800">Pop Up Zone</h1>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed max-w-lg">
            Build a pop-up menu, test it in the sandbox, then publish it or schedule it to launch
            on its own. Only one pop-up is live at a time — publishing a new one closes voting on
            the last.
          </p>
        </div>
        <Link
          href="/admin/popup/new"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#C97D5A] text-white text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          New Pop Up
        </Link>
      </header>

      {live && (
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 bg-green-50 border border-green-200 text-xs text-green-800">
          <span className="font-medium">Live now:</span>
          <span>{live.title}</span>
          <a
            href="/popup"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 underline hover:no-underline"
          >
            View public page <ExternalLink size={11} />
          </a>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      ) : menus.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200">
          <p className="text-sm text-gray-400">No pop-ups yet.</p>
          <Link
            href="/admin/popup/new"
            className="inline-block mt-3 text-xs tracking-wider uppercase text-[#C97D5A] hover:opacity-80"
          >
            Create the first one →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {menus.map((m) => {
            const style = STATUS_STYLE[m.status] ?? STATUS_STYLE.draft;
            const when = formatWhen(m.goLiveAt);
            return (
              <div
                key={m.id}
                onClick={() => router.push(`/admin/popup/${m.id}`)}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 bg-white border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 text-[10px] tracking-wider uppercase ${style.className}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-sm text-gray-800">{m.title}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    /popup/m/{m.slug}
                    {when && (
                      <>
                        {" · "}
                        {m.status === "scheduled" ? "Launches" : "Launched"} {when}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <GlassWater size={12} />
                    {m.cocktailCount}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={12} />
                    {m.voterCount}
                  </span>
                </div>

                <a
                  href={`/popup/preview/${m.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-[#C97D5A] transition-colors"
                >
                  Sandbox <ExternalLink size={11} />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
