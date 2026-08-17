"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const ACCENT = "#C97D5A";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  // Only follow same-site paths — never an absolute URL from the query string.
  const rawFrom = params.get("from") ?? "/popup";
  const from = rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/popup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "confirm_failed"
      ? "That confirmation link has expired or was already used. Sign in and we can send a new one."
      : params.get("error") === "unavailable"
        ? "Guest accounts aren't set up yet. Please check back soon."
        : null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/popup/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not sign you in.");
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <h1
        style={{ fontFamily: "var(--font-display, serif)" }}
        className="text-3xl text-white text-center"
      >
        Welcome back
      </h1>

      <form onSubmit={submit} className="mt-9 space-y-4">
        <label className="block">
          <span className="block text-[10px] tracking-[0.2em] uppercase text-white/45 mb-1.5">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className="w-full px-3.5 py-3 bg-white/[0.05] border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
          />
        </label>

        <label className="block">
          <span className="block text-[10px] tracking-[0.2em] uppercase text-white/45 mb-1.5">
            Password
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="w-full px-3.5 py-3 bg-white/[0.05] border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
          />
        </label>

        {error && (
          <p className="text-xs text-red-300 leading-relaxed" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ background: ACCENT }}
          className="w-full py-3.5 rounded-lg text-[11px] tracking-[0.2em] uppercase text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-white/40">
        New here?{" "}
        <Link href="/popup/signup" style={{ color: ACCENT }} className="hover:opacity-80">
          Create an account
        </Link>
      </p>
    </div>
  );
}
