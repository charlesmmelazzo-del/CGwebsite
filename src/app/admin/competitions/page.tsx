"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Users, Sparkles, ExternalLink } from "lucide-react";
import type { CompStatus } from "@/lib/compete/types";

type Row = {
  id: string;
  slug: string;
  name: string;
  featuredSpirit: string;
  eventDate: string | null;
  status: CompStatus;
  isDemo: boolean;
  listed: boolean;
  contestants: number;
  approved: number;
};

const STATUS_STYLE: Record<CompStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-500" },
  published: { label: "Published", className: "bg-blue-100 text-blue-700" },
  live: { label: "Live", className: "bg-green-100 text-green-700" },
  finished: { label: "Finished", className: "bg-amber-50 text-amber-700" },
};

function fmtDate(d: string | null) {
  if (!d) return "No date set";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminCompetitionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "new" | "demo">("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/competitions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load competitions.");
      setRows(data.events ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load competitions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const name = window.prompt("Name the competition (you can change it later):", "");
    if (!name?.trim()) return;
    setBusy("new");
    const res = await fetch("/api/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json();
    setBusy("");
    if (!res.ok) return setError(d.error);
    router.push(`/admin/competitions/${d.id}`);
  }

  async function demo() {
    const exists = rows.some((r) => r.isDemo);
    if (exists && !window.confirm("Reset the Cascahuín demo? Its votes, codes and any edits will be replaced with a fresh copy.")) return;
    setBusy("demo");
    const res = await fetch("/api/admin/competitions/demo", { method: "POST" });
    const d = await res.json();
    setBusy("");
    if (!res.ok) return setError(d.error);
    router.push(`/admin/competitions/${d.id}`);
  }

  return (
    <div className="max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg text-gray-800">Cocktail Competitions</h1>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed max-w-lg">
            Live, host-run bartender competitions. Invite a brand partner and contestants by private link, print ticket
            codes for guests, then run the night from the host screen while everyone votes from their phones.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={demo}
            disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-600 text-xs tracking-wider uppercase hover:border-gray-400 disabled:opacity-50"
          >
            {busy === "demo" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {rows.some((r) => r.isDemo) ? "Reset Demo" : "Create Demo Event"}
          </button>
          <button
            onClick={create}
            disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C97D5A] text-white text-xs tracking-wider uppercase hover:opacity-90 disabled:opacity-50"
          >
            {busy === "new" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            New Competition
          </button>
        </div>
      </header>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200">
          <p className="text-sm text-gray-400">No competitions yet.</p>
          <p className="mt-2 text-xs text-gray-400">Create one, or load the Cascahuín demo to see how it all works.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.draft;
            return (
              <div
                key={r.id}
                onClick={() => router.push(`/admin/competitions/${r.id}`)}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 bg-white border border-gray-200 hover:border-gray-300 cursor-pointer"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 text-[10px] tracking-wider uppercase ${st.className}`}>{st.label}</span>
                    {r.isDemo && <span className="px-2 py-0.5 text-[10px] tracking-wider uppercase bg-purple-50 text-purple-600">Demo</span>}
                    {r.status !== "draft" && !r.listed && <span className="px-2 py-0.5 text-[10px] tracking-wider uppercase bg-amber-50 text-amber-700">Link only</span>}
                    <span className="text-sm text-gray-800">{r.name}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    {fmtDate(r.eventDate)}
                    {r.featuredSpirit && ` · ${r.featuredSpirit}`} · /compete/{r.slug}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Users size={12} /> {r.approved}/{r.contestants} approved
                </span>
                {r.status !== "draft" && (
                  <a
                    href={`/compete/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-[#C97D5A]"
                  >
                    Guest page <ExternalLink size={11} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
