"use client";

import { useCallback, useEffect, useState } from "react";
import { C, Notice, inputCls, postJson } from "./ui";
import { Sheet } from "./Social";
import { useShell } from "./shellContext";
import { notifyChanged } from "./appEvents";
import { whenShort } from "@/lib/passport/inbox";
import { COMMENT_MAX, DELETED_LINE, PG_LINE, REMOVED_LINE, canStillEdit } from "@/lib/passport/votes";
import type { CommentThread, CommentType, PComment } from "@/lib/passport/types";

/**
 * File 10, Part 1: the comments place on one of the bar's curated items (a house list, a message from the bar, a Passport
 * event, a flight vote or a bracket). It draws NOTHING while comments are off there (the item's switch or the bar's
 * global one): never an empty box. Other members appear by display name only; the bar as "Common Good · {first name}".
 * One level of replies; the author may edit for 10 minutes and delete any time; report a comment or block its author.
 */
const smallBtn = "rounded-full border px-4 min-h-[40px] font-body text-[12px] tracking-[0.12em] uppercase transition-colors disabled:opacity-50 pp-focus pp-press";
const linkBtn = "font-body text-[12px] underline underline-offset-4 min-h-[36px] pp-focus";

export default function Comments({ type, id }: { type: CommentType; id: number }) {
  const shell = useShell();
  const [t, setT] = useState<CommentThread | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okPg, setOkPg] = useState(false);
  const [replyTo, setReplyTo] = useState<PComment | null>(null);
  const [editing, setEditing] = useState<PComment | null>(null);
  const [acting, setActing] = useState<{ c: PComment; what: "report" | "block" } | null>(null);
  const url = `/api/passport/comments/${type}/${id}`;
  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setT(data.comments ?? null); notifyChanged("inbox"); }
    } catch { /* offline: show nothing new */ }
    setLoaded(true);
  }, [url]);
  useEffect(() => { void load(); }, [load]);
  if (!loaded || !t) return null;

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setError("");
    const r = editing
      ? await postJson<{ comments: CommentThread }>(`/api/passport/comment/${editing.id}`, { body: text }, "PUT")
      : await postJson<{ comments: CommentThread }>(url, { body: text, ...(replyTo ? { parent_id: replyTo.id } : {}) });
    setBusy(false);
    if (!r.ok) { setError(r.data.error || "Couldn't post that. Please try again."); return; }
    setT(r.data.comments); setText(""); setReplyTo(null); setEditing(null);
    shell?.toast(editing ? "Saved." : "Posted.");
  };
  const remove = async (c: PComment) => {
    const r = await postJson<{ comments: CommentThread | null }>(`/api/passport/comment/${c.id}`, {}, "DELETE");
    if (!r.ok) { shell?.toast(r.data.error || "Couldn't delete that."); return; }
    if (r.data.comments !== undefined) setT(r.data.comments);
    shell?.toast("Deleted.");
  };
  const writing = t.can_write && (!t.first_time || okPg);
  const row = (c: PComment, reply = false) => {
    const gone = c.removed || c.deleted;
    return (
      <li key={c.id} className={`py-3 ${reply ? "ml-5 pl-3 border-l" : "border-b"}`} style={{ borderColor: C.line }}>
        {!gone && (
          <p className="font-body text-[12px] flex items-baseline gap-1.5 flex-wrap" style={{ color: C.faint }}>
            <span style={{ color: c.from === "bar" ? C.brass : C.text }} className="font-semibold">{c.name}</span>
            {c.from === "bar" && <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color: C.brass }}>From the bar</span>}
            <span>{whenShort(c.at)}</span>{c.edited && <span>· edited</span>}
          </p>
        )}
        <p className="font-body text-[15px] mt-0.5 whitespace-pre-wrap break-words" style={{ color: gone ? C.faint : C.text, fontStyle: gone ? "italic" : undefined }}>
          {c.removed ? REMOVED_LINE : c.deleted ? DELETED_LINE : c.body}
        </p>
        {!gone && (
          <div className="flex gap-4 flex-wrap" style={{ color: C.muted }}>
            {!reply && t.can_write && <button type="button" className={linkBtn} onClick={() => { setReplyTo(c); setEditing(null); setText(""); }}>Reply</button>}
            {c.from === "me" && canStillEdit(c.edit_until) && <button type="button" className={linkBtn} onClick={() => { setEditing(c); setReplyTo(null); setText(c.body); }}>Edit</button>}
            {c.from === "me" && <button type="button" className={linkBtn} onClick={() => remove(c)}>Delete</button>}
            {c.from === "member" && <button type="button" className={linkBtn} onClick={() => setActing({ c, what: "report" })}>Report</button>}
            {c.from === "member" && <button type="button" className={linkBtn} onClick={() => setActing({ c, what: "block" })}>Block</button>}
          </div>
        )}
        {!!c.replies?.length && <ul className="mt-1">{c.replies.map((r) => row(r, true))}</ul>}
      </li>
    );
  };
  return (
    <section aria-labelledby={`pp-comments-${type}-${id}`} className="mt-10">
      <h2 id={`pp-comments-${type}-${id}`} className="font-body text-[11px] tracking-[0.3em] uppercase mb-3" style={{ color: C.brass }}>Comments</h2>
      {t.can_write && t.first_time && !okPg && (
        <div className="rounded-xl border p-4 mb-4" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
          <p className="font-body text-[15px]" style={{ color: C.text }}>Before your first comment: {PG_LINE}</p>
          <p className="font-body text-[13px] mt-1" style={{ color: C.muted }}>Other members see your display name and what you write. Our team can remove a comment.</p>
          <button type="button" className={`${smallBtn} mt-3`} style={{ borderColor: C.brass, color: C.brass }} onClick={() => setOkPg(true)}>I&rsquo;ll keep it kind</button>
        </div>
      )}
      {writing && (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="space-y-2 mb-2">
          {(replyTo || editing) && (
            <p className="font-body text-[13px]" style={{ color: C.muted }}>
              {editing ? "Changing your comment" : `Replying to ${replyTo?.from === "me" ? "yourself" : replyTo?.name}`} · <button type="button" className="underline" onClick={() => { setReplyTo(null); setEditing(null); setText(""); }}>cancel</button>
            </p>
          )}
          <label className="sr-only" htmlFor={`pp-c-${type}-${id}`}>Your comment</label>
          <textarea id={`pp-c-${type}-${id}`} rows={3} maxLength={COMMENT_MAX} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder={replyTo ? "Write a reply" : "Add a comment"} />
          <div className="flex items-center justify-between gap-3">
            <span className="font-body text-[11px] leading-snug" style={{ color: C.faint }}>{text.length > COMMENT_MAX - 80 ? `${COMMENT_MAX - text.length} left · ` : ""}{t.note || PG_LINE}</span>
            <button type="submit" disabled={busy || !text.trim()} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>{busy ? "Posting…" : editing ? "Save" : replyTo ? "Reply" : "Post"}</button>
          </div>
          {error && <Notice>{error}</Notice>}
        </form>
      )}
      {!t.can_write && t.why_not && <p className="font-body text-sm mb-2" style={{ color: C.muted }}>{t.why_not}</p>}
      {t.items.length ? <ul>{t.items.map((c) => row(c))}</ul> : <p className="font-body text-sm" style={{ color: C.faint }}>No comments yet.</p>}
      {acting && <ActSheet c={acting.c} what={acting.what} onClose={() => setActing(null)} onDone={(msg) => { setActing(null); shell?.toast(msg); void load(); }} />}
    </section>
  );
}

/** Report a comment (an optional reason; admins see it at once) or block its author (silent, file 09's block). */
function ActSheet({ c, what, onClose, onDone }: { c: PComment; what: "report" | "block"; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    const r = await postJson(`/api/passport/comment/${c.id}`, what === "report" ? { action: "report", reason } : { action: "block" });
    setBusy(false);
    if (!r.ok) { setError(r.data.error || "Couldn't do that. Please try again."); return; }
    onDone(what === "report" ? "Thank you. Our team will take a look." : `${c.name} is blocked.`);
  };
  return (
    <Sheet title={what === "report" ? "Report this comment" : `Block ${c.name}?`} onClose={onClose}>
      <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>
        {what === "report" ? `Our team will see this comment and the replies around it. ${c.name} won't be told who reported it.` : `You won't see each other's comments, and they can't reach you on Passport. They aren't told. You can unblock them in Account.`}
      </p>
      {what === "report" && (
        <>
          <label className="block font-body text-[11px] tracking-[0.2em] uppercase mt-4 mb-1.5" style={{ color: C.muted }} htmlFor="pp-report-reason">What&rsquo;s wrong (optional)</label>
          <textarea id="pp-report-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </>
      )}
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      <button type="button" disabled={busy} onClick={go} className={`${smallBtn} w-full mt-4`} style={{ borderColor: C.accent, color: C.accent }}>{busy ? "One moment…" : what === "report" ? "Send report" : "Block"}</button>
    </Sheet>
  );
}
