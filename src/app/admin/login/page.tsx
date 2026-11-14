"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.replace(from);
      } else if (res.status === 429) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Too many attempts. Try again later.");
        setPassword("");
      } else {
        setError("Incorrect username or password. Try again.");
        setPassword("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#1A1F17" }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="relative w-20 h-20">
            <Image
              src="/images/logo/logo.svg"
              alt="Common Good"
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        </div>

        <p
          className="text-center text-[#5a6a4a] text-[10px] tracking-[0.3em] uppercase mb-8"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Admin Panel
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="admin-username"
              className="block text-[10px] tracking-[0.2em] uppercase text-[#4a5a3a] mb-2"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent border-b border-[#2a3020] text-[#8A9A78] text-sm py-2 outline-none focus:border-[#C97D5A] transition-colors placeholder:text-[#2a3020]"
              style={{ fontFamily: "var(--font-body)" }}
              placeholder="Enter username"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-[10px] tracking-[0.2em] uppercase text-[#4a5a3a] mb-2"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-transparent border-b border-[#2a3020] text-[#8A9A78] text-sm py-2 outline-none focus:border-[#C97D5A] transition-colors placeholder:text-[#2a3020]"
              style={{ fontFamily: "var(--font-body)" }}
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p
              className="text-xs text-red-400/80 tracking-wide"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 bg-[#C97D5A] text-white text-[11px] tracking-[0.25em] uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-40"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-[10px] tracking-widest uppercase text-[#3a4a2a] hover:text-[#5a6a4a] transition-colors"
            style={{ fontFamily: "var(--font-body)" }}
          >
            ← Back to site
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
