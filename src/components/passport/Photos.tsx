"use client";
/* eslint-disable @next/next/no-img-element -- members' photos come only through their own signed-in route, never the image optimizer. */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { C, Notice, inputCls, postJson } from "./ui";
import { itemHref } from "./personalShared";
import { myPhotoSrc, type ItemKind, type MemberPhoto, type PhotoLimits, type PhotosData } from "@/lib/passport/types";
import { ACCENTS } from "@/lib/passport/accents";

/**
 * File 11, Part 4: a member's own photos. Up to three on any cocktail or bottle they may open, with an optional caption.
 * Shrunk on the phone before sending (longest side 1600px, JPEG, aiming under 400 KB); the Bible checks it and saves it
 * again with nothing of the original kept. Private to the member and to the Common Good team.
 */
export const PHOTO_PRIVATE_LINE = "Only you and the Common Good team can see your photos.";
const smallBtn = "rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] tracking-[0.12em] uppercase transition-colors disabled:opacity-50 pp-focus pp-press";
const MAX_SIDE = 1600;
const TARGET = 400 * 1024;
const MAX_BYTES = 15 * 1024 * 1024;

async function decode(file: File): Promise<{ draw: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { draw: b, w: b.width, h: b.height, done: () => b.close() };
    } catch { /* fall back to an <img> */ }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("decode")); img.src = url; });
  return { draw: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}
const toBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", q));

/**
 * Shrink a photo on the device: longest side 1600px, JPEG, trying lower quality until it is under 400 KB. A photo this
 * browser can't read (a HEIC on some computers) goes as it is when it is under 15 MB: the Bible reads it and shrinks it.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let src: Awaited<ReturnType<typeof decode>>;
  try { src = await decode(file); } catch {
    if (file.size <= MAX_BYTES) return file;
    throw new Error("That photo is over 15 MB. Please choose a smaller one.");
  }
  try {
    let side = MAX_SIDE;
    for (let pass = 0; pass < 2; pass++) {
      const scale = Math.min(1, side / Math.max(src.w, src.h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(src.w * scale));
      canvas.height = Math.max(1, Math.round(src.h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src.draw, 0, 0, canvas.width, canvas.height);
      let best: Blob | null = null;
      for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const b = await toBlob(canvas, q);
        if (!b) break;
        best = b;
        if (b.size <= TARGET) return b;
      }
      if (best && pass === 1) return best;
      side = 1200;
    }
  } finally { src.done(); }
  if (file.size <= MAX_BYTES) return file;
  throw new Error("That photo could not be read. Please try another.");
}

const dateWords = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** A full-screen view of one of the member's photos, with its caption and Delete. */
function Viewer({ p, onClose, onDelete, itemLink }: { p: MemberPhoto; onClose: () => void; onDelete?: () => Promise<void>; itemLink?: { href: string; name: string } | null }) {
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  if (!p.id || typeof document === "undefined") return null;
  // Over everything, the app's bars included: a page that slides over a tab is its own layer, so this goes to <body>.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Your photo" className="fixed inset-0 z-[90] flex flex-col" style={{ background: "rgba(8,10,6,0.97)" }}>
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <span className="font-body text-[0.75rem] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Your photo</span>
        <button ref={close} type="button" onClick={onClose} className="min-w-[44px] min-h-[44px] font-body text-sm pp-focus rounded" style={{ color: C.text }}>Close</button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-2">
        <img src={myPhotoSrc(p.id, "full")} alt={p.caption || "Your photo"} className="max-w-full max-h-full object-contain rounded" />
      </div>
      <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] space-y-2">
        {p.caption && <p className="font-display italic text-lg" style={{ color: C.text }}>{p.caption}</p>}
        <p className="font-body text-[0.875rem]" style={{ color: C.faint }}>{dateWords(p.at)}{itemLink ? <> · <Link href={itemLink.href} scroll={false} className="underline underline-offset-4" style={{ color: C.muted }}>{itemLink.name}</Link></> : null}</p>
        {onDelete && (sure ? (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="font-body text-sm" style={{ color: C.text }}>Delete this photo?</span>
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(); } finally { setBusy(false); } }} className={smallBtn} style={{ borderColor: C.accent, color: C.accent }}>Delete</button>
            <button type="button" onClick={() => setSure(false)} className={smallBtn} style={{ borderColor: C.line, color: C.text }}>Keep it</button>
          </div>
        ) : (
          <button type="button" onClick={() => setSure(true)} className={smallBtn} style={{ borderColor: C.line, color: C.muted }}>Delete</button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** "Your photos" on a cocktail or bottle page: the member's own, with "Add a photo" (up to three here). */
export function MyItemPhotos({ kind, id, name }: { kind: ItemKind; id: number; name: string }) {
  const router = useRouter();
  const [data, setData] = useState<PhotosData | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<MemberPhoto | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/passport/photos?kind=${kind}&id=${id}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setData(d as PhotosData);
    else if (d.signed_out) router.refresh();
  }, [kind, id, router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);
  const limits: PhotoLimits | null = data?.photo_limits || null;
  const choose = async (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { setError("Please choose a photo (JPEG, PNG, WebP or HEIC)."); return; }
    setBusy(true);
    try {
      const blob = await shrinkPhoto(f);
      setPicked({ blob, url: URL.createObjectURL(blob) });
      setCaption("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const send = async () => {
    if (!picked) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("kind", kind); fd.append("id", String(id)); fd.append("caption", caption.trim());
      fd.append("photo", picked.blob, "photo.jpg");
      const r = await fetch("/api/passport/photos", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { if (d.signed_out) router.refresh(); setError(d.error || "That photo could not be added. Please try again."); return; }
      setData(d as PhotosData); setPicked(null); setCaption("");
    } catch { setError("That photo could not be added. Please try again."); } finally { setBusy(false); }
  };
  const remove = async (p: MemberPhoto) => {
    const r = await postJson("/api/passport/photos", { id: p.id }, "DELETE");
    if (!r.ok) { setError(r.data.error || "That photo could not be deleted."); return; }
    setOpen(null);
    await load();
  };
  const photos = data?.photos || [];
  const full = !!limits && limits.left_here <= 0;
  const why = limits && !full ? (limits.left_today <= 0 ? "You've added 20 photos today. You can add more tomorrow." : limits.left_total <= 0 ? "You're keeping 300 photos, the most there is room for. Delete some in My photos to add more." : "") : "";
  return (
    <section className="mt-6 rounded-xl border p-5 space-y-3" style={{ borderColor: C.line, background: C.card }} aria-label="Your photos">
      <div className="flex items-center justify-between gap-3">
        <h2 className="pp-t-section mb-3" style={{ color: ACCENTS["yours"].ink }}>Your photos</h2>
        {photos.length > 0 && <Link href="/passport/photos" scroll={false} className="font-body text-[0.875rem] underline underline-offset-4 pp-focus" style={{ color: C.muted }}>My photos</Link>}
      </div>
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => p.id && (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p)} className="block w-full pp-focus rounded-md" aria-label={p.caption ? `Your photo: ${p.caption}` : "Your photo"}>
                <img src={myPhotoSrc(p.id, "thumb")} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-md" style={{ background: C.bg }} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked ? (
        <div className="space-y-3">
          <img src={picked.url} alt="The photo you chose" className="w-full max-h-[50vh] object-contain rounded-md" style={{ background: C.bg }} />
          <label className="block">
            <span className="block font-body text-[0.75rem] tracking-[0.2em] uppercase mb-1.5" style={{ color: C.muted }}>Caption (optional)</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, limits?.caption_max || 120))} maxLength={limits?.caption_max || 120} className={inputCls} placeholder={`At the bar with ${name}`} />
            <span className="block font-body text-[0.875rem] mt-1.5 text-right" style={{ color: C.faint }}>{caption.length}/{limits?.caption_max || 120}</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={busy} onClick={send} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>{busy ? "Saving…" : "Save photo"}</button>
            <button type="button" disabled={busy} onClick={() => setPicked(null)} className={smallBtn} style={{ borderColor: C.line, color: C.text }}>Cancel</button>
          </div>
        </div>
      ) : full ? (
        <p className="font-body text-sm" style={{ color: C.muted }}>You have {limits?.per_item} photos here, the most for one {kind}. Delete one to add another.</p>
      ) : why ? (
        <p className="font-body text-sm" style={{ color: C.muted }}>{why}</p>
      ) : (
        <div>
          <input ref={input} type="file" accept="image/*,.heic,.heif" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => choose(e.target.files?.[0])} />
          <button type="button" disabled={busy || !data} onClick={() => input.current?.click()} className={smallBtn} style={{ borderColor: C.line, color: C.text }}>
            {busy ? "Getting it ready…" : photos.length ? "Add another photo" : "Add a photo"}
          </button>
        </div>
      )}
      <p className="font-body text-[0.875rem]" style={{ color: C.faint }}>{PHOTO_PRIVATE_LINE}</p>
      {error && <Notice>{error}</Notice>}
      {open && <Viewer p={open} onClose={() => setOpen(null)} onDelete={() => remove(open)} />}
    </section>
  );
}

/** "My photos" (Index → Yours): every photo the member kept, newest first, each opening its item. */
export function MyPhotosList({ initial }: { initial: PhotosData }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState<MemberPhoto | null>(null);
  const [error, setError] = useState("");
  const remove = async (p: MemberPhoto) => {
    const r = await postJson("/api/passport/photos", { id: p.id }, "DELETE");
    if (!r.ok) { if (r.data.signed_out) router.refresh(); setError(r.data.error || "That photo could not be deleted."); return; }
    setOpen(null);
    setData({ ...data, photos: data.photos.filter((x) => x.id !== p.id) });
  };
  const kept = data.photos.filter((p) => !p.removed).length;
  return (
    <div className="mt-6 space-y-4">
      <p className="font-body text-sm" style={{ color: C.muted }}>{PHOTO_PRIVATE_LINE}</p>
      {error && <Notice>{error}</Notice>}
      {data.photos.length === 0 ? (
        <p className="font-body text-[1rem] leading-relaxed" style={{ color: C.muted }}>
          No photos yet. Open any cocktail or bottle and tap &ldquo;Add a photo&rdquo; to keep one of your own, up to three on each.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.photos.map((p, i) => {
            const href = p.kind ? itemHref(p.kind, p.opens ? p.item_id ?? null : null) : null;
            if (p.removed) {
              return (
                <li key={`removed-${i}`} className="rounded-md border p-3 flex flex-col justify-center aspect-square" style={{ borderColor: C.line }}>
                  <p className="font-body text-[0.875rem] tracking-[0.12em] uppercase" style={{ color: C.faint }}>Removed by Common Good</p>
                  <p className="font-body text-sm mt-1" style={{ color: C.muted }}>{p.item_name}</p>
                </li>
              );
            }
            return (
              <li key={p.id}>
                <button type="button" onClick={() => setOpen(p)} className="block w-full pp-focus rounded-md" aria-label={`Your photo of ${p.item_name}${p.caption ? `: ${p.caption}` : ""}`}>
                  <img src={myPhotoSrc(p.id as string, "thumb")} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-md" style={{ background: C.card }} />
                </button>
                {href
                  ? <Link href={href} scroll={false} className="block font-body text-sm mt-1.5 truncate pp-focus rounded-sm" style={{ color: C.text }}>{p.item_name}</Link>
                  : <span className="block font-body text-sm mt-1.5 truncate" style={{ color: C.muted }}>{p.item_name}</span>}
                {p.caption && <span className="block font-body text-[0.875rem] truncate" style={{ color: C.faint }}>{p.caption}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {kept > 0 && <p className="font-body text-[0.875rem]" style={{ color: C.faint }}>{kept} kept · up to 300 in all, 20 a day</p>}
      {open && (
        <Viewer p={open} onClose={() => setOpen(null)} onDelete={() => remove(open)}
          itemLink={open.kind && open.opens && open.item_id ? { href: itemHref(open.kind, open.item_id) as string, name: open.item_name || "" } : null} />
      )}
    </div>
  );
}
