import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MenuPdfPage } from "@/types";
import type { CoffeeLiveConfig } from "@/lib/coffee/live";

export interface CoffeeMenu {
  id: string;
  label: string;
  imageUrl: string | null;
  alt: string;
  order: number;
  active: boolean;
  pdfUrl?: string;            // a PDF menu, shown instead of the image
  pdfPages?: MenuPdfPage[];
  live?: CoffeeLiveConfig | null; // Coffee 01: the live Toast menu settings for this tab
}

// GET — return all menus ordered by order_num
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("coffee_menus")
      .select("*")
      .order("order_num");

    if (error) throw error;

    const menus: CoffeeMenu[] = (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      imageUrl: r.image_url,
      alt: r.alt ?? "",
      order: r.order_num,
      active: r.active,
      pdfUrl: r.pdf_url ?? undefined,
      pdfPages: r.pdf_pages ?? undefined,
      live: r.live ?? null,
    }));

    return NextResponse.json({ menus });
  } catch (e) {
    console.error("[GET /api/admin/coffee]", e);
    return NextResponse.json({ menus: [], error: "Failed to load" }, { status: 500 });
  }
}

// POST — save all menus (upsert + delete removed)
export async function POST(req: NextRequest) {
  try {
    const { menus } = await req.json();
    const sb = getSupabaseAdmin();
    const menuList: CoffeeMenu[] = menus ?? [];

    console.log("[coffee POST] saving", menuList.length, "menus");

    // Get existing IDs
    const { data: existing } = await sb.from("coffee_menus").select("id");
    const existingIds = new Set((existing ?? []).map((r) => r.id as string));
    const newIds = new Set(menuList.map((m) => m.id));

    // Delete removed menus
    const removedIds = Array.from(existingIds).filter((id) => !newIds.has(id));
    if (removedIds.length > 0) {
      const { error } = await sb.from("coffee_menus").delete().in("id", removedIds);
      if (error) throw error;
      console.log("[coffee POST] deleted", removedIds.length, "menus");
    }

    // Upsert all current menus
    let warning = "";
    if (menuList.length > 0) {
      const rows = menuList.map((m) => ({
        id: m.id,
        label: m.label,
        image_url: m.imageUrl,
        alt: m.alt ?? "",
        order_num: m.order,
        active: m.active,
        pdf_url: m.pdfUrl ?? null,
        pdf_pages: m.pdfPages ?? null,
        live: cleanLive(m.live),
        updated_at: new Date().toISOString(),
      }));
      let { error } = await sb.from("coffee_menus").upsert(rows, { onConflict: "id" });
      // Coffee 01: before db/coffee-live-menu.sql has been run there is no "live" column. Save everything else and say so.
      if (error && /\blive\b/.test(error.message ?? "")) {
        ({ error } = await sb.from("coffee_menus").upsert(rows.map((r) => ({ ...r, live: undefined })).map((r) => { delete r.live; return r; }), { onConflict: "id" }));
        warning = "Saved, except the live menu settings: run db/coffee-live-menu.sql in Supabase first.";
      }
      if (error) throw error;
      console.log("[coffee POST] upserted", menuList.length, "menus OK");
    }

    // Verify
    const { data: verify } = await sb.from("coffee_menus").select("id");
    console.log("[coffee POST] verified", verify?.length, "menus in DB");

    return NextResponse.json({ success: true, ...(warning ? { warning } : {}) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("[POST /api/admin/coffee]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/** Coffee 01: keep only the known live-menu settings, with short strings (ids are the feed's hashed ids). */
function cleanLive(v: unknown): CoffeeLiveConfig | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const ID = /^[a-z]_[0-9a-f]{6,32}$/i;
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string" && ID.test(i)).slice(0, 500) : undefined);
  const texts = (x: unknown, max: number) => {
    if (!x || typeof x !== "object") return undefined;
    const out: Record<string, string> = {};
    for (const [k, t] of Object.entries(x as Record<string, unknown>)) {
      if (ID.test(k) && typeof t === "string" && t.trim()) out[k] = t.trim().slice(0, max);
    }
    return out;
  };
  return {
    ...(typeof o.showPdf === "boolean" ? { showPdf: o.showPdf } : {}),
    ...(Array.isArray(o.sections) ? { sections: ids(o.sections) } : {}),
    items: ids(o.items) ?? [],
    order: ids(o.order) ?? [],
    labels: texts(o.labels, 80) ?? {},
    notes: texts(o.notes, 300) ?? {},
    hiddenSections: ids(o.hiddenSections) ?? [],
    hiddenItems: ids(o.hiddenItems) ?? [],
    itemNotes: texts(o.itemNotes, 120) ?? {},
    // Coffee 02: option-group display names / hidden groups (keyed by Toast's group name), and display sections.
    groupLabels: groupTexts(o.groupLabels),
    hiddenGroups: Array.isArray(o.hiddenGroups) ? o.hiddenGroups.filter((g): g is string => typeof g === "string" && !!g.trim()).map((g) => g.trim().slice(0, 60)).slice(0, 50) : [],
    displaySections: Array.isArray(o.displaySections)
      ? o.displaySections
        .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && typeof (d as { id?: unknown }).id === "string" && /^d_[0-9a-f]{6,32}$/i.test((d as { id: string }).id))
        .slice(0, 30)
        .map((d) => ({
          id: d.id as string,
          heading: typeof d.heading === "string" ? d.heading.trim().slice(0, 80) : "",
          ...(typeof d.note === "string" && d.note.trim() ? { note: d.note.trim().slice(0, 300) } : {}),
          items: ids(d.items) ?? [],
        }))
      : [],
  };
}

/** Coffee 02: Toast group name → the name guests see ("" allowed: show just the options). */
function groupTexts(x: unknown): Record<string, string> {
  if (!x || typeof x !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, t] of Object.entries(x as Record<string, unknown>).slice(0, 50)) {
    if (typeof k === "string" && k.trim() && typeof t === "string") out[k.trim().slice(0, 60)] = t.trim().slice(0, 60);
  }
  return out;
}
