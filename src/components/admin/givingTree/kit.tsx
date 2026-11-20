"use client";

// Shared bits for the Giving Tree admin. Phone-first: big tap targets,
// one column, nothing that needs hover.

import type { ReactNode } from "react";
import type { AdminOpp, AdminPledge, Snapshot } from "@/lib/givingTree/admin";

export type { AdminOpp, AdminPledge, Snapshot };

/** POST an action to the admin API; resolves with the JSON or throws its error. */
export type Act = (body: Record<string, unknown>, opts?: { reload?: boolean }) => Promise<Record<string, unknown>>;

export function Card({ title, children, actions }: { title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 p-4 space-y-3">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-medium text-gray-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  kind = "plain",
  disabled,
  type = "button",
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "plain" | "primary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  small?: boolean;
}) {
  const k =
    kind === "primary"
      ? "bg-[#C97D5A] border-[#C97D5A] text-white"
      : kind === "danger"
        ? "bg-white border-red-300 text-red-700"
        : "bg-white border-gray-300 text-gray-700";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${small ? "min-h-[36px] px-2.5 text-[11px]" : "min-h-[44px] px-4 text-xs"} border tracking-wide disabled:opacity-50 ${k}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-widest uppercase text-gray-500 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full min-h-[44px] border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white";

export function Text(props: { value: string | number | null | undefined; onChange: (v: string) => void; type?: string; placeholder?: string; inputMode?: "text" | "decimal" | "email" | "tel" | "numeric" }) {
  return <input className={inputCls} type={props.type ?? "text"} inputMode={props.inputMode} placeholder={props.placeholder} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} />;
}

export function Area(props: { value: string | null | undefined; onChange: (v: string) => void; rows?: number }) {
  return <textarea className={inputCls} rows={props.rows ?? 3} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} />;
}

export function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 min-h-[40px] text-sm text-gray-700">
      <input type="checkbox" className="h-5 w-5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "amber" | "red" | "blue" }) {
  const t = { gray: "bg-gray-100 text-gray-600", green: "bg-green-100 text-green-700", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-700", blue: "bg-blue-100 text-blue-700" }[tone];
  return <span className={`inline-block px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${t}`}>{children}</span>;
}

export const TYPE_LABEL = { volunteer: "Volunteer", gift: "Gift", cash: "Cash" } as const;

export const HOLD_LABEL: Record<string, string> = {
  none: "",
  held_moderation: "Held: wording",
  held_amount: "Held: amount",
  denied: "Denied",
};

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
