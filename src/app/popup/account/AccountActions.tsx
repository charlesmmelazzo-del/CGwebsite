"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCENT = "#C97D5A";

/** Resend confirmation + sign out — the only interactive bits of the account page. */
export default function AccountActions({ emailVerified }: { emailVerified: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/popup/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not send the email.");
      else setMsg("Sent — check your inbox.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/popup/session", { method: "DELETE" });
    router.push("/popup");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-3">
      {!emailVerified && (
        <>
          <button
            onClick={resend}
            disabled={busy}
            style={{ background: ACCENT }}
            className="w-full py-3 rounded-lg text-[11px] tracking-[0.2em] uppercase text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {busy ? "Sending…" : "Resend confirmation email"}
          </button>
          {msg && <p className="text-xs text-green-300 text-center">{msg}</p>}
          {error && <p className="text-xs text-red-300 text-center">{error}</p>}
        </>
      )}

      <button
        onClick={signOut}
        className="w-full py-3 rounded-lg text-[11px] tracking-[0.2em] uppercase text-white/50 border border-white/15 hover:text-white hover:border-white/30 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
