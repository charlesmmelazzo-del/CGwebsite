"use client";

// Small admin-panel controls in the existing admin look (white cards, gray
// type, terracotta accent).

import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, Copy, QrCode, X } from "lucide-react";
import QRCode from "qrcode";

export const ACCENT = "#C97D5A";

export function Card({ title, help, children, actions }: { title?: string; help?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 p-5">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && <h2 className="text-sm text-gray-800">{title}</h2>}
            {help && <p className="mt-1 text-xs text-gray-400 leading-relaxed max-w-2xl">{help}</p>}
          </div>
          {actions && <div className="shrink-0 flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="block mb-1.5">
      <span className="block text-[11px] tracking-wider uppercase text-gray-500">{children}</span>
      {hint && <span className="block text-[11px] text-gray-400 mt-0.5 normal-case tracking-normal">{hint}</span>}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C97D5A] bg-white ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={4}
      {...props}
      className={`w-full border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#C97D5A] bg-white leading-relaxed resize-y ${props.className ?? ""}`}
    />
  );
}

export function Btn({
  children,
  onClick,
  kind = "primary",
  disabled,
  type = "button",
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  small?: boolean;
}) {
  const base = `inline-flex items-center justify-center gap-1.5 ${small ? "px-3 py-1.5 text-[10px]" : "px-4 py-2.5 text-xs"} tracking-wider uppercase transition-opacity disabled:opacity-40`;
  const look =
    kind === "primary"
      ? "bg-[#C97D5A] text-white hover:opacity-90"
      : kind === "danger"
        ? "border border-red-200 text-red-600 hover:bg-red-50"
        : "border border-gray-300 text-gray-600 hover:border-gray-400";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

export function Badge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    invited: ["Not submitted", "bg-gray-100 text-gray-500"],
    submitted: ["Needs review", "bg-amber-100 text-amber-700"],
    changes_requested: ["Changes requested", "bg-orange-50 text-orange-700"],
    approved: ["Approved", "bg-green-100 text-green-700"],
    draft: ["Draft", "bg-gray-100 text-gray-500"],
    published: ["Published", "bg-blue-100 text-blue-700"],
    live: ["Live", "bg-green-100 text-green-700"],
    finished: ["Finished", "bg-amber-50 text-amber-700"],
  };
  const [label, cls] = map[status] ?? [status, "bg-gray-100 text-gray-500"];
  return <span className={`px-2 py-0.5 text-[10px] tracking-wider uppercase whitespace-nowrap ${cls}`}>{label}</span>;
}

/** A link with Copy and Show QR — for invite links and the host link. */
export function LinkBox({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (showQr && !qr) QRCode.toDataURL(url, { margin: 1, width: 480 }).then(setQr).catch(() => {});
  }, [showQr, qr, url]);

  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex items-stretch gap-1.5">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600" />
        <button
          type="button"
          className="px-3 border border-gray-200 text-gray-500 hover:text-gray-800"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          title="Copy link"
        >
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        </button>
        <button type="button" className="px-3 border border-gray-200 text-gray-500 hover:text-gray-800" onClick={() => setShowQr(true)} title="Show QR code">
          <QrCode size={14} />
        </button>
      </div>
      {showQr && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setShowQr(false)}>
          <div className="bg-white p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button onClick={() => setShowQr(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            {qr ? <img src={qr} alt="QR code" className="w-full" /> : <div className="aspect-square bg-gray-100" />}
            <p className="mt-3 text-[11px] text-gray-500 break-all">{url}</p>
            {qr && (
              <a href={qr} download="qr-code.png" className="inline-block mt-4 text-xs tracking-wider uppercase text-[#C97D5A]">
                Download QR image
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Central-time date helpers ───────────────────────────────────────────────
// Deadlines are stored as real timestamps; the admin types them in Glen Ellyn time.

const TZ = "America/Chicago";

function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in Central time, for <input type="datetime-local">. */
export function isoToCentralLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + offsetMinutes(d) * 60000);
  return shifted.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" typed as Central time → ISO timestamp. */
export function centralLocalToIso(local: string): string {
  if (!local) return "";
  const guess = new Date(`${local}:00Z`);
  const off = offsetMinutes(guess);
  return new Date(guess.getTime() - off * 60000).toISOString();
}

// ─── Photo upload (admin) ────────────────────────────────────────────────────

export function AdminPhoto({
  value,
  onChange,
  eventId,
  aspect = "aspect-square",
  contain,
  accept = "image/*",
}: {
  value?: string;
  onChange: (url: string) => void;
  eventId: string;
  aspect?: string;
  contain?: boolean;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = `up-${useId().replace(/:/g, "")}`;

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "admin");
    fd.append("eventId", eventId);
    try {
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
    <div className="w-28">
      <div className={`relative ${aspect} w-full border border-dashed border-gray-300 bg-gray-800 overflow-hidden`}>
        {value ? (
          <img src={value} alt="" className={`w-full h-full ${contain ? "object-contain p-2" : "object-cover"}`} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] tracking-wider uppercase text-gray-400">
            {busy ? "Uploading…" : "No photo"}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex gap-2 text-[10px] tracking-wider uppercase">
        <label htmlFor={id} className="cursor-pointer text-[#C97D5A]">
          {value ? "Replace" : "Upload"}
        </label>
        {value && (
          <button type="button" className="text-gray-400" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
      <input
        id={id}
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
