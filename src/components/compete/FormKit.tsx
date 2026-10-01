"use client";

// Form pieces shared by the contestant and brand-partner links.

import { useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { InlineText } from "@/lib/compete/richtext";

export function StepHeader({ step, total, title, intro }: { step?: number; total?: number; title: string; intro?: ReactNode }) {
  return (
    <div className="text-center">
      {step !== undefined && total !== undefined && (
        <div className="flex items-center justify-center gap-1.5 mb-6" aria-label={`Step ${step} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="h-[3px] w-6 transition-colors"
              style={{ background: i < step ? "var(--cmp-accent)" : "var(--cmp-line)" }}
            />
          ))}
        </div>
      )}
      <h2 className="cmp-display text-4xl">{title}</h2>
      {intro && <p className="mt-4 cmp-muted text-[15px] leading-relaxed">{intro}</p>}
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  required,
  optional,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-medium">
        {label}
        {required && <span className="cmp-muted font-normal italic"> (required)</span>}
        {optional && <span className="cmp-muted font-normal italic"> (optional)</span>}
      </label>
      {hint && (
        <p className="mt-1 text-sm cmp-muted leading-relaxed">
          <InlineText text={hint} />
        </p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`cmp-input ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={`cmp-input resize-y min-h-[110px] leading-relaxed ${props.className ?? ""}`} />;
}

/**
 * Upload one photo through /api/compete/upload.
 *
 * Keep `accept` generic ("image/*" or explicit JPG/PNG/WebP): if HEIC is
 * listed, iPhones send their photos as HEIC, which the server can't decode.
 * Otherwise Safari converts them to JPEG on the way out.
 */
export function PhotoUpload({
  value,
  onChange,
  kind,
  token,
  aspect = "aspect-[4/5]",
  accept = "image/*",
  fit = "cover",
  small,
}: {
  value?: string;
  onChange: (url: string) => void;
  kind: "contestant" | "partner" | "admin";
  token: string;
  aspect?: string;
  accept?: string;
  fit?: "cover" | "contain";
  small?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      fd.append("token", token);
      if (kind === "admin") fd.append("eventId", token);
      const res = await fetch("/api/compete/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onChange(d.url);
    } catch (e) {
      setError((e as Error).message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={small ? "w-32" : "w-full max-w-xs"}>
      <div
        className={`relative ${aspect} w-full border border-dashed border-[var(--cmp-line)] bg-[var(--cmp-surface)] flex items-center justify-center overflow-hidden`}
      >
        {value ? (
          <>
            <img src={value} alt="" className={`w-full h-full ${fit === "contain" ? "object-contain p-3" : "object-cover"}`} />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center"
              aria-label="Remove photo"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 cmp-muted"
          >
            {busy ? <Loader2 className="animate-spin" size={22} /> : <ImagePlus size={22} strokeWidth={1.4} />}
            <span className="text-[11px] tracking-[0.16em] uppercase">{busy ? "Uploading…" : "Add Photo"}</span>
          </button>
        )}
      </div>
      {value && (
        <button type="button" onClick={() => input.current?.click()} className="mt-2 text-xs tracking-[0.14em] uppercase cmp-muted">
          {busy ? "Uploading…" : "Replace"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue",
  busy,
  disabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-12 flex gap-3">
      {onBack && (
        <button type="button" onClick={onBack} className="cmp-btn-ghost flex-1" disabled={busy}>
          Back
        </button>
      )}
      <button type="button" onClick={onNext} className="cmp-btn flex-[2]" disabled={busy || disabled}>
        {busy && <Loader2 size={15} className="animate-spin" />} {nextLabel}
      </button>
    </div>
  );
}

export function Shell({
  accent,
  cgLogo,
  brandLogo,
  eventName,
  children,
}: {
  accent: string;
  cgLogo: string;
  brandLogo?: string;
  eventName: string;
  children: ReactNode;
}) {
  return (
    <div className="cmp" style={{ ["--cmp-accent" as string]: accent }}>
      <header className="border-b border-[var(--cmp-line)] h-16 px-5 flex items-center justify-center gap-3">
        <img src={cgLogo} alt="Common Good" className="h-8 w-auto" />
        {brandLogo && (
          <>
            <span className="cmp-faint text-sm">×</span>
            <img src={brandLogo} alt="" className="h-7 w-auto" />
          </>
        )}
      </header>
      <main className="mx-auto max-w-xl px-5 py-12 pb-24">{children}</main>
      <footer className="pb-10 text-center text-[11px] tracking-[0.2em] uppercase cmp-faint">{eventName} · Common Good Cocktail House</footer>
    </div>
  );
}

export function StatusPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="text-center cmp-rise">
      <h2 className="cmp-display text-4xl">{title}</h2>
      <div className="mt-6 cmp-prose space-y-4">{children}</div>
    </div>
  );
}
