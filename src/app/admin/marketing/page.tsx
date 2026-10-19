"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import type { MarketingContact } from "@/lib/marketing";

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Filter = "all" | "optedIn";

/**
 * Every email address guests have given us, one row per address, ready to
 * export to Mailchimp. Merges pop-up sign-ups with Pop Up Zone accounts.
 */
export default function AdminMarketingPage() {
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the email list.");
      setContacts(data.contacts ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the email list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const optedInCount = useMemo(() => contacts.filter((c) => c.optedIn).length, [contacts]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        (filter === "all" || c.optedIn) &&
        (!q || [c.email, c.firstName, c.lastName, ...c.sources].some((v) => v.toLowerCase().includes(q)))
    );
  }, [contacts, query, filter]);

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg text-gray-800">Email List</h1>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed max-w-xl">
            Everyone who has given us their email: guests who asked to hear about future pop-ups,
            plus every Pop Up Zone account. Each address appears once, however many times it
            signed up. Download the CSV and import it into Mailchimp.
          </p>
        </div>
        <a
          href={`/api/admin/marketing/export${filter === "optedIn" ? "?optedIn=1" : ""}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-xs tracking-wider uppercase hover:bg-gray-700"
        >
          <Download size={14} />
          Download CSV
        </a>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email, name or source"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
        </div>
        <div className="flex border border-gray-200 text-xs">
          {(
            [
              ["all", `Everyone (${contacts.length})`],
              ["optedIn", `Asked to hear from us (${optedInCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 ${filter === key ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-[11px] text-gray-400 leading-relaxed max-w-2xl">
        Pop Up Zone accounts signed up to play, not to get newsletters. Mailchimp expects
        permission to email people, so &ldquo;Asked to hear from us&rdquo; is the safest list to
        import. The download follows the filter you&apos;ve picked.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-400 py-10">
          {contacts.length === 0 ? "No emails yet." : "Nothing matches that search."}
        </p>
      ) : (
        <div className="border border-gray-200 bg-white max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-[10px] tracking-widest uppercase text-gray-400">
              <tr>
                <th className="text-left font-normal px-4 py-2.5">Email</th>
                <th className="text-left font-normal px-4 py-2.5">Name</th>
                <th className="text-left font-normal px-4 py-2.5">Source</th>
                <th className="text-left font-normal px-4 py-2.5 whitespace-nowrap">First seen</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.email} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-700 break-all">{c.email}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{c.sources.join(", ")}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(c.firstSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && shown.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          Showing {shown.length} of {contacts.length}
        </p>
      )}
    </div>
  );
}
