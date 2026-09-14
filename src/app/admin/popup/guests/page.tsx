"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2, X } from "lucide-react";
import type { GuestAccount } from "@/lib/popup/guests";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Pop Up Zone guest accounts. One account works across every pop-up, so this
 * lives beside the pop-up list rather than inside any one of them.
 */
export default function AdminGuestsPage() {
  const [guests, setGuests] = useState<GuestAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<GuestAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/popup/guests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load guests.");
      setGuests(data.guests ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load guests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) =>
      [g.email, g.firstName, g.lastName].some((v) => v.toLowerCase().includes(q))
    );
  }, [guests, query]);

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h1 className="text-lg text-gray-800">Guest Accounts</h1>
        <p className="mt-1 text-xs text-gray-400 leading-relaxed max-w-lg">
          Everyone who has signed up for the Pop Up Zone. One account works for every pop-up —
          it&apos;s what guests use to play High Score Runs.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 max-w-sm">
        <Search size={14} className="text-gray-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="flex-1 text-sm focus:outline-none"
        />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-400 py-16 text-center border border-dashed border-gray-200">
          {guests.length ? "Nobody matches that search." : "No guests have signed up yet."}
        </p>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-widest uppercase text-gray-400 border-b border-gray-200">
                <th className="text-left font-normal px-4 py-2.5">Name</th>
                <th className="text-left font-normal px-4 py-2.5">Email</th>
                <th className="text-right font-normal px-4 py-2.5">Ticket runs</th>
                <th className="text-left font-normal px-4 py-2.5">Joined</th>
                <th className="text-left font-normal px-4 py-2.5">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => setEditing(g)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-gray-800 whitespace-nowrap">
                    {[g.firstName, g.lastName].filter(Boolean).join(" ") || (
                      <span className="text-gray-300">No name</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <span className="break-all">{g.email}</span>
                    {!g.emailConfirmed && (
                      <span className="ml-2 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] tracking-wider uppercase whitespace-nowrap">
                        Unconfirmed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{g.ticketRuns}</td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(g.createdAt)}</td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(g.lastSignInAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <GuestEditor
          guest={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GuestEditor({
  guest,
  onClose,
  onSaved,
}: {
  guest: GuestAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email,
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        method === "DELETE"
          ? `/api/admin/popup/guests?id=${encodeURIComponent(guest.id)}`
          : "/api/admin/popup/guests",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify({ id: guest.id, ...body }) : undefined,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  function save() {
    const patch: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
    };
    if (form.email.trim().toLowerCase() !== guest.email) patch.email = form.email;
    if (form.password) patch.password = form.password;
    send("PATCH", patch);
  }

  function remove() {
    if (
      !confirm(
        `Delete ${guest.email}? Their high scores and ticket history are removed too. This cannot be undone.`
      )
    )
      return;
    send("DELETE");
  }

  const field =
    "w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm text-gray-800">Edit guest</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Joined {formatDate(guest.createdAt)} · {guest.ticketRuns} ticket{" "}
              {guest.ticketRuns === 1 ? "run" : "runs"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">First name</span>
            <input className={field} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Last name</span>
            <input className={field} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </label>
        </div>

        <label className="block mb-3">
          <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Email (their username)</span>
          <input type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>

        <label className="block mb-1">
          <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">New password</span>
          <input
            type="text"
            autoComplete="off"
            className={field}
            value={form.password}
            placeholder="Leave blank to keep their current one"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <p className="mb-4 text-[10px] text-gray-400">
          For a guest who is locked out. At least 8 characters — tell them what you set.
        </p>

        {!guest.emailConfirmed && (
          <button
            onClick={() => send("PATCH", { confirmEmail: true })}
            disabled={busy}
            className="mb-4 w-full px-4 py-2 border border-amber-200 bg-amber-50 text-[11px] tracking-wider uppercase text-amber-700 hover:border-amber-400 disabled:opacity-40"
          >
            Mark email as confirmed
          </button>
        )}

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={remove}
            disabled={busy}
            className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase text-gray-400 hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 size={13} /> Delete
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="px-5 py-2.5 bg-[#C97D5A] text-white text-xs tracking-wider uppercase hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
