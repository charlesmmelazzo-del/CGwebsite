"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";

const ACCENT = "#C97D5A";

/**
 * Guest sign-up. Email + password, name, and date of birth for the 21+ check.
 *
 * The age check here is a courtesy so the guest gets an instant answer — the
 * real gate is in /api/popup/signup, which recomputes the age server-side and
 * refuses to create an account at all if it's under 21.
 */
export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/popup/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create your account.");
        return;
      }
      if (data.needsConfirmation) {
        setSentTo(data.email ?? form.email);
      } else {
        router.push("/popup");
        router.refresh();
      }
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <MailCheck size={32} style={{ color: ACCENT }} className="mx-auto" />
        <h1
          style={{ fontFamily: "var(--font-display, serif)" }}
          className="mt-5 text-2xl text-white"
        >
          Check your email
        </h1>
        <p className="mt-4 text-sm text-white/60 leading-relaxed">
          We sent a confirmation link to{" "}
          <span className="text-white/90 break-all">{sentTo}</span>. Click it and you&apos;re in.
        </p>
        <p className="mt-4 text-xs text-white/40 leading-relaxed">
          You can look around the pop-up before confirming — you just need a confirmed email to
          cast your vote.
        </p>
        <Link
          href="/popup"
          className="inline-block mt-8 text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors"
        >
          Go to the pop-up →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-14 sm:py-20">
      <h1
        style={{ fontFamily: "var(--font-display, serif)" }}
        className="text-3xl text-white text-center"
      >
        Join the Pop Up Zone
      </h1>
      <p className="mt-3 text-center text-xs text-white/45 leading-relaxed">
        One account lets you vote on every pop-up. Must be 21 or older.
      </p>

      <form onSubmit={submit} className="mt-9 space-y-4">
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => set("email", v)}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(v) => set("password", v)}
          autoComplete="new-password"
          hint="At least 8 characters"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="First name"
            value={form.firstName}
            onChange={(v) => set("firstName", v)}
            autoComplete="given-name"
            required
          />
          <Field
            label="Last name"
            value={form.lastName}
            onChange={(v) => set("lastName", v)}
            autoComplete="family-name"
            required
          />
        </div>

        <Field
          label="Date of birth"
          type="date"
          value={form.dateOfBirth}
          onChange={(v) => set("dateOfBirth", v)}
          autoComplete="bday"
          hint="You must be 21 or older to join"
          required
        />

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
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-white/40">
        Already have an account?{" "}
        <Link href="/popup/login" style={{ color: ACCENT }} className="hover:opacity-80">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.2em] uppercase text-white/45 mb-1.5">
        {label}
      </span>
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-3 bg-white/[0.05] border border-white/15 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors [color-scheme:dark]"
      />
      {hint && <span className="block mt-1 text-[10px] text-white/30">{hint}</span>}
    </label>
  );
}
