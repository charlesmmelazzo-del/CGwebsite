"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, KeyRound, Pencil, RefreshCw, Copy, Check, X, ShieldCheck } from "lucide-react";
import { labelCls, inputCls } from "@/components/admin/SectionCard";

// Admin panel users — MAIN ADMIN ONLY (the middleware and the API both enforce
// it; this page is just the screen).
//
// The main admin makes each person a username and a password here and hands
// them over directly — no emails or invitations. Passwords are stored scrambled,
// so they can be replaced but never looked up again.

type User = { id: string; username: string; name: string; createdAt: string; lastLoginAt: string | null };

const MIN_PASSWORD = 8;

// No look-alike characters (0/O, 1/l/I), so a password read off a screen or a
// sticky note gets typed correctly.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(): string {
  const picks = new Uint32Array(14);
  crypto.getRandomValues(picks);
  return Array.from(picks, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

function when(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const btn = "flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-widest uppercase transition-colors disabled:opacity-50";
const btnPrimary = `${btn} bg-[#C97D5A] text-white hover:bg-[#b86d4a]`;
const btnQuiet = `${btn} border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 bg-white`;

/** Password box with a Generate button. Shown as plain text on purpose — the
 *  main admin has to read it to pass it on. */
function PasswordField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={`${inputCls} font-mono`}
        placeholder={`At least ${MIN_PASSWORD} characters`}
      />
      <button type="button" onClick={() => onChange(generatePassword())} className={`${btnQuiet} shrink-0`}>
        <RefreshCw size={12} /> Generate
      </button>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Add-user form
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // One row at a time can be open for editing, a new password, or removal
  const [open, setOpen] = useState<{ id: string; mode: "edit" | "password" | "remove" } | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Sign-in details to hand over, shown once after creating or resetting
  const [handover, setHandover] = useState<{ name: string; username: string; password: string; reset: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(method: string, body?: unknown) {
    const res = await fetch("/api/admin/users", {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.setup) setNeedsSetup(true);
      throw new Error(data.error ?? "Something went wrong. Please try again.");
    }
    return data;
  }

  useEffect(() => {
    call("GET")
      .then((d) => setUsers(d.users ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startAdding() {
    setAdding(true);
    setOpen(null);
    setError("");
    setName("");
    setUsername("");
    setPassword(generatePassword());
  }

  function addUser(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      const { user } = await call("POST", { name, username, password });
      setUsers((u) => [...u, user]);
      setHandover({ name: user.name || user.username, username: user.username, password, reset: false });
      setCopied(false);
      setAdding(false);
    });
  }

  function openRow(u: User, mode: "edit" | "password" | "remove") {
    setAdding(false);
    setError("");
    setOpen({ id: u.id, mode });
    setEditName(u.name);
    setEditUsername(u.username);
    setNewPassword(mode === "password" ? generatePassword() : "");
  }

  function saveEdit(u: User) {
    run(async () => {
      const { user } = await call("PATCH", { id: u.id, name: editName, username: editUsername });
      setUsers((list) => list.map((x) => (x.id === u.id ? user : x)));
      setOpen(null);
    });
  }

  function savePassword(u: User) {
    run(async () => {
      await call("PATCH", { id: u.id, password: newPassword });
      setHandover({ name: u.name || u.username, username: u.username, password: newPassword, reset: true });
      setCopied(false);
      setOpen(null);
    });
  }

  function removeUser(u: User) {
    run(async () => {
      await call("DELETE", { id: u.id });
      setUsers((list) => list.filter((x) => x.id !== u.id));
      setOpen(null);
      if (handover?.username === u.username) setHandover(null);
    });
  }

  async function copyHandover() {
    if (!handover) return;
    try {
      await navigator.clipboard.writeText(`Username: ${handover.username}\nPassword: ${handover.password}`);
      setCopied(true);
    } catch {
      // Clipboard blocked — the details are on screen to copy by hand.
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-sm">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>Users</h1>
          <p className="text-gray-500 text-sm mt-1">
            People who can sign in to this admin and make edits. Only you, the main admin, can see this page.
          </p>
        </div>
        {!adding && !needsSetup && (
          <button onClick={startAdding} className={`${btnPrimary} shrink-0`}>
            <Plus size={14} /> Add User
          </button>
        )}
      </div>

      {needsSetup && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-sm">
          <p className="font-medium mb-1">One-time setup needed</p>
          <p>
            The users table hasn&apos;t been created in Supabase yet. Run <code>db/admin-users.sql</code> in the
            Supabase SQL Editor, then reload this page. Your own sign-in keeps working either way.
          </p>
        </div>
      )}

      {error && !needsSetup && (
        <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm">
          {error}
        </div>
      )}

      {handover && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-green-900">
              {handover.reset
                ? <>New password set for <strong>{handover.name}</strong>. They&apos;ve been signed out and will need it to get back in.</>
                : <><strong>{handover.name}</strong> can now sign in. Pass these details on to them:</>}
            </p>
            <button onClick={() => setHandover(null)} aria-label="Dismiss" className="text-green-700/60 hover:text-green-900">
              <X size={16} />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-green-800/70">Username</dt>
            <dd className="font-mono text-green-950 break-all">{handover.username}</dd>
            <dt className="text-green-800/70">Password</dt>
            <dd className="font-mono text-green-950 break-all">{handover.password}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={copyHandover} className={btnQuiet}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
            <p className="text-xs text-green-800/80">
              Save it now — the password can&apos;t be shown again after you leave this page.
            </p>
          </div>
        </div>
      )}

      {adding && (
        <form onSubmit={addUser} className="mb-6 p-5 bg-white border border-gray-200 rounded-sm space-y-4">
          <h2 className="text-sm tracking-widest uppercase text-gray-400">New user</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-name" className={labelCls}>Name</label>
              <input id="new-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                autoFocus maxLength={80} className={inputCls} placeholder="e.g. Jamie Rivera" />
            </div>
            <div>
              <label htmlFor="new-username" className={labelCls}>Username</label>
              <input id="new-username" type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={30}
                className={inputCls} placeholder="e.g. jamie" />
            </div>
          </div>
          <div>
            <label htmlFor="new-password" className={labelCls}>Password</label>
            <PasswordField id="new-password" value={password} onChange={setPassword} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !username || password.length < MIN_PASSWORD} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create User
            </button>
            <button type="button" onClick={() => setAdding(false)} className={btnQuiet}>Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-sm divide-y divide-gray-100">
        {/* The main admin — always there, not editable here */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <ShieldCheck size={16} className="text-[#C97D5A] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-gray-800">Main admin <span className="text-gray-400">(you)</span></p>
            <p className="text-xs text-gray-400">
              Signs in as <span className="font-mono">admin</span> · Can do everything, including managing users
            </p>
          </div>
        </div>

        {users.map((u) => {
          const mode = open?.id === u.id ? open.mode : null;
          return (
            <div key={u.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{u.name || u.username}</p>
                  <p className="text-xs text-gray-400">
                    Signs in as <span className="font-mono">{u.username}</span> · Added {when(u.createdAt)} · Last signed in: {when(u.lastLoginAt)}
                  </p>
                </div>
                {!mode && (
                  <div className="flex gap-1.5">
                    <button onClick={() => openRow(u, "edit")} className={btnQuiet} title="Change name or username">
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => openRow(u, "password")} className={btnQuiet} title="Set a new password">
                      <KeyRound size={12} /> Password
                    </button>
                    <button onClick={() => openRow(u, "remove")} className={`${btnQuiet} hover:!text-red-600 hover:!border-red-200`} title="Remove this user">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                )}
              </div>

              {mode === "edit" && (
                <form onSubmit={(e) => { e.preventDefault(); saveEdit(u); }} className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`name-${u.id}`} className={labelCls}>Name</label>
                      <input id={`name-${u.id}`} type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        autoFocus maxLength={80} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor={`username-${u.id}`} className={labelCls}>Username</label>
                      <input id={`username-${u.id}`} type="text" value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
                        required autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={30} className={inputCls} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy || !editUsername} className={btnPrimary}>
                      {busy && <Loader2 size={14} className="animate-spin" />} Save
                    </button>
                    <button type="button" onClick={() => setOpen(null)} className={btnQuiet}>Cancel</button>
                  </div>
                </form>
              )}

              {mode === "password" && (
                <form onSubmit={(e) => { e.preventDefault(); savePassword(u); }} className="mt-3 space-y-3">
                  <div>
                    <label htmlFor={`password-${u.id}`} className={labelCls}>New password</label>
                    <PasswordField id={`password-${u.id}`} value={newPassword} onChange={setNewPassword} />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Their old password stops working and they&apos;re signed out wherever they were signed in.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy || newPassword.length < MIN_PASSWORD} className={btnPrimary}>
                      {busy && <Loader2 size={14} className="animate-spin" />} Set Password
                    </button>
                    <button type="button" onClick={() => setOpen(null)} className={btnQuiet}>Cancel</button>
                  </div>
                </form>
              )}

              {mode === "remove" && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-sm">
                  <p className="text-sm text-red-800">
                    Remove <strong>{u.name || u.username}</strong>? They lose access to the admin straight away.
                    Nothing they&apos;ve edited on the site is changed.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => removeUser(u)} disabled={busy} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={12} />} Remove User
                    </button>
                    <button onClick={() => setOpen(null)} className={btnQuiet}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {users.length === 0 && !needsSetup && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            No other users yet. Add one to give someone their own sign-in.
          </p>
        )}
      </div>
    </div>
  );
}
