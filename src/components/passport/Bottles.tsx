"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { C, Notice, inputCls, postJson } from "./ui";
import { MAX_QTY, MIN_QTY, NAME_MAX, NOTE_MAX, NO_PRICE_LINE, longDay, money, sortRequests } from "@/lib/passport/bottles";
import type { BottleRequest, BottleRequests } from "@/lib/passport/bible";

/**
 * File 05: bottle requests, the member's side. Everything goes through /api/passport/bottles, which only ever acts for
 * the signed-in member. A price shows only once the bar confirmed it; it is never the bar's cost.
 */

const OFFLINE = "Couldn't send that. Please try again.";
const smallBtn = "rounded-full border px-4 py-2 font-body text-[12px] tracking-[0.12em] uppercase transition-colors disabled:opacity-50";

/** A small status label (Library.tsx has one too, but it is server-only through its imports). */
function Label({ children, brass = false }: { children: ReactNode; brass?: boolean }) {
  return (
    <span className="font-body text-[10px] tracking-[0.18em] uppercase rounded px-1.5 py-0.5 border whitespace-nowrap"
      style={{ color: brass ? C.brass : C.muted, borderColor: brass ? `${C.brass}80` : C.line }}>
      {children}
    </span>
  );
}

function QuantityPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label="How many bottles">
      <button type="button" className={smallBtn} style={{ borderColor: C.line, color: C.text }} disabled={value <= MIN_QTY} onClick={() => onChange(value - 1)} aria-label="One fewer">−</button>
      <span className="font-display text-2xl w-8 text-center" style={{ color: C.text }} aria-live="polite">{value}</span>
      <button type="button" className={smallBtn} style={{ borderColor: C.line, color: C.text }} disabled={value >= MAX_QTY} onClick={() => onChange(value + 1)} aria-label="One more">+</button>
      <span className="font-body text-xs" style={{ color: C.faint }}>{value === 1 ? "bottle" : "bottles"}</span>
    </div>
  );
}

function useSend() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async <T,>(url: string, body: unknown): Promise<T | null> => {
    setBusy(true);
    setError("");
    const r = await postJson<T>(url, body);
    setBusy(false);
    if (r.ok) return r.data;
    if (r.data.signed_out) { router.refresh(); return null; }
    setError(r.data.error || OFFLINE);
    return null;
  };
  return { send, busy, error, router };
}

// ── "Request a bottle for home" on a bottle page ─────────────────────────────
export function RequestBottle({ bottleId, name }: { bottleId: number; name: string }) {
  const { send, busy, error } = useSend();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <section className="mt-8 rounded-xl border p-5" style={{ borderColor: `${C.brass}66`, background: C.card }}>
        <p className="font-display text-xl" style={{ color: C.text }}>We have your request.</p>
        <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>{NO_PRICE_LINE} You can follow it in <Link href="/passport/bottles" className="underline" style={{ color: C.text }}>My bottles</Link>.</p>
      </section>
    );
  }
  return (
    <section className="mt-8 rounded-xl border p-5" style={{ borderColor: C.line, background: C.card }} aria-label="Request a bottle for home">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={smallBtn} style={{ borderColor: C.brass, color: C.brass }}>Request a bottle for home</button>
      ) : (
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          const out = await send<{ request: BottleRequest }>("/api/passport/bottles", { bottle_id: bottleId, quantity: qty, note });
          if (out) setDone(true);
        }}>
          <p className="font-display text-xl" style={{ color: C.text }}>A bottle of {name} for home</p>
          <QuantityPicker value={qty} onChange={setQty} />
          <label className="block">
            <span className="block font-body text-[11px] tracking-[0.2em] uppercase mb-1.5" style={{ color: C.muted }}>A note for us (optional)</span>
            <textarea rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. It's a gift" />
          </label>
          <p className="font-body text-sm" style={{ color: C.muted }}>{NO_PRICE_LINE}</p>
          {error && <Notice>{error}</Notice>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>{busy ? "Sending…" : "Send request"}</button>
            <button type="button" onClick={() => setOpen(false)} className={smallBtn} style={{ borderColor: C.line, color: C.muted }}>Not now</button>
          </div>
        </form>
      )}
    </section>
  );
}

// ── My bottles ───────────────────────────────────────────────────────────────
function RequestCard({ r, onChange }: { r: BottleRequest; onChange: (r: BottleRequest) => void }) {
  const { send, busy, error } = useSend();
  const [confirming, setConfirming] = useState<"decline" | "cancel" | null>(null);
  const act = async (action: "accept" | "decline" | "cancel") => {
    const out = await send<{ request: BottleRequest }>(`/api/passport/bottles/${r.id}`, action === "accept" ? { action, quote_id: r.quote?.id } : { action });
    if (out) { setConfirming(null); onChange(out.request); }
  };
  const q = r.quote;
  const title = <span className="font-display text-[22px] leading-tight" style={{ color: C.text }}>{r.name}</span>;
  const closed = ["picked_up", "declined", "cancelled", "quote_declined", "pickup_declined"].includes(r.status);
  return (
    <li className="rounded-xl border p-5" style={{ borderColor: r.status === "ready" ? `${C.brass}99` : C.line, background: C.card, opacity: closed ? 0.75 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {r.bottle_id ? <Link href={`/passport/spirits/${r.bottle_id}`}>{title}</Link> : title}
          <p className="font-body text-xs mt-1" style={{ color: C.faint }}>{r.quantity} {r.quantity === 1 ? "bottle" : "bottles"}{r.kind === "other" ? " · something we don't carry" : ""}</p>
        </div>
        <Label brass={r.status === "ready" || r.can_answer}>{r.status_label}</Label>
      </div>
      {r.note && <p className="font-body text-sm mt-3 italic" style={{ color: C.muted }}>“{r.note}”</p>}

      {r.status === "submitted" && <p className="font-body text-sm mt-3" style={{ color: C.muted }}>{NO_PRICE_LINE}</p>}
      {q && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: C.line }}>
          <p className="font-body text-[15px]" style={{ color: C.text }}>
            <span className="font-display text-2xl">{money(q.price_cents)}</span> a bottle
            {q.quantity > 1 && <> · {money(q.total_cents)} for {q.quantity}</>}
            <span style={{ color: C.muted }}> · plus tax</span>
          </p>
          {q.message && <p className="font-body text-sm mt-2" style={{ color: C.muted }}>{q.message}</p>}
          {r.can_answer && q.expires_on && <p className="font-body text-xs mt-2" style={{ color: C.faint }}>Good until {longDay(q.expires_on)}. Nothing is ordered until you accept; you pay at the bar when you pick it up.</p>}
          {r.status === "quoted" && q.expired && <p className="font-body text-xs mt-2" style={{ color: C.faint }}>This price has expired. We&rsquo;ll be in touch with a new one.</p>}
          {q.state === "accepted" && <p className="font-body text-xs mt-2" style={{ color: C.faint }}>You accepted this price.</p>}
        </div>
      )}
      {r.status === "ordered" && <p className="font-body text-sm mt-3" style={{ color: C.text }}>Ordered{r.eta ? <>. We expect it around <strong>{longDay(r.eta)}</strong>.</> : "."}</p>}
      {r.status === "ready" && <p className="font-body text-sm mt-3" style={{ color: C.text }}>It&rsquo;s at the bar, set aside for you. Pick it up any time we&rsquo;re open.</p>}
      {r.status === "declined" && r.decline_reason && <p className="font-body text-sm mt-3" style={{ color: C.muted }}>{r.decline_reason}</p>}
      {r.message && (
        <p className="font-body text-sm mt-3 border-l-2 pl-3" style={{ borderColor: C.brass, color: C.text }}>
          {r.message}<span className="block text-[11px] mt-1" style={{ color: C.faint }}>From the bar</span>
        </p>
      )}

      {(r.can_answer || r.can_cancel) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.can_answer && !confirming && (
            <>
              <button type="button" disabled={busy} onClick={() => act("accept")} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>Accept, please order it</button>
              <button type="button" disabled={busy} onClick={() => setConfirming("decline")} className={smallBtn} style={{ borderColor: C.line, color: C.text }}>No thanks</button>
            </>
          )}
          {r.can_cancel && !r.can_answer && !confirming && (
            <button type="button" disabled={busy} onClick={() => setConfirming("cancel")} className={smallBtn} style={{ borderColor: C.line, color: C.muted }}>Cancel request</button>
          )}
          {confirming && (
            <div className="w-full space-y-2">
              <p className="font-body text-sm" style={{ color: C.text }}>{confirming === "decline" ? "Decline this price? That closes the request." : "Cancel this request?"}</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => act(confirming)} className={smallBtn} style={{ borderColor: C.accent, color: C.accent }}>{confirming === "decline" ? "Decline" : "Cancel it"}</button>
                <button type="button" disabled={busy} onClick={() => setConfirming(null)} className={smallBtn} style={{ borderColor: C.line, color: C.muted }}>Keep it</button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
    </li>
  );
}

function SomethingElse({ disabled, onAdded }: { disabled: boolean; onAdded: (r: BottleRequest) => void }) {
  const { send, busy, error } = useSend();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={`${smallBtn} mt-2`} style={{ borderColor: C.brass, color: C.brass }}>
        Something we don&rsquo;t carry
      </button>
    );
  }
  return (
    <form className="mt-2 rounded-xl border p-5 space-y-4" style={{ borderColor: C.line, background: C.card }} onSubmit={async (e) => {
      e.preventDefault();
      const out = await send<{ request: BottleRequest }>("/api/passport/bottles", { name, quantity: qty, note });
      if (out) { onAdded(out.request); setOpen(false); setName(""); setNote(""); setQty(1); }
    }}>
      <label className="block">
        <span className="block font-body text-[11px] tracking-[0.2em] uppercase mb-1.5" style={{ color: C.muted }}>The bottle</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} className={inputCls} placeholder="Producer, name and age, if you know it" required />
      </label>
      <QuantityPicker value={qty} onChange={setQty} />
      <label className="block">
        <span className="block font-body text-[11px] tracking-[0.2em] uppercase mb-1.5" style={{ color: C.muted }}>A note for us (optional)</span>
        <textarea rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </label>
      <p className="font-body text-sm" style={{ color: C.muted }}>{NO_PRICE_LINE}</p>
      {error && <Notice>{error}</Notice>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy || !name.trim()} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>{busy ? "Sending…" : "Send request"}</button>
        <button type="button" onClick={() => setOpen(false)} className={smallBtn} style={{ borderColor: C.line, color: C.muted }}>Not now</button>
      </div>
    </form>
  );
}

export function MyBottles({ initial }: { initial: BottleRequests }) {
  const [list, setList] = useState(initial.requests);
  const open = list.filter((r) => ["submitted", "quoted", "accepted", "ordered", "ready"].includes(r.status)).length;
  const full = open >= initial.max_open;
  const replace = (r: BottleRequest) => setList((cur) => sortRequests(cur.some((x) => x.id === r.id) ? cur.map((x) => (x.id === r.id ? r : x)) : [r, ...cur]));
  return (
    <div>
      <p className="font-body text-[15px] leading-relaxed" style={{ color: C.muted }}>
        Ask us to order a bottle for home from any bottle page, or tell us about one we don&rsquo;t carry. {NO_PRICE_LINE}
      </p>
      <SomethingElse disabled={full} onAdded={replace} />
      {full && <p className="font-body text-xs mt-2" style={{ color: C.faint }}>You have {initial.max_open} open requests, the most at one time. Cancel one, or wait for one to be picked up.</p>}
      {list.length ? (
        <ul className="mt-6 space-y-3">{sortRequests(list).map((r) => <RequestCard key={r.id} r={r} onChange={replace} />)}</ul>
      ) : (
        <p className="font-body text-sm mt-8" style={{ color: C.faint }}>No bottle requests yet.</p>
      )}
    </div>
  );
}
