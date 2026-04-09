import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const [tabsRes, itemsRes] = await Promise.all([
      sb.from("coffee_tabs").select("*").order("order"),
      sb.from("coffee_items").select("*").order("order"),
    ]);
    const tabs = (tabsRes.data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      order: r.order,
      active: r.active,
    }));
    const items = (itemsRes.data ?? []).map((r) => ({
      id: r.id,
      tabId: r.tab_id,
      title: r.title,
      description: r.description ?? undefined,
      price: r.price ?? undefined,
      carouselImageUrl: r.carousel_image_url ?? undefined,
      menuPageImageUrl: r.menu_page_image_url ?? undefined,
      alt: r.alt ?? undefined,
      tagLine: r.tag_line ?? undefined,
      ingredients: r.ingredients ?? undefined,
      tastingNotes: r.tasting_notes ?? undefined,
      notableNotes: r.notable_notes ?? undefined,
      order: r.order,
      active: r.active,
      titleColor: r.title_color ?? undefined,
      descriptionColor: r.description_color ?? undefined,
      priceColor: r.price_color ?? undefined,
    }));
    return NextResponse.json({ tabs, items });
  } catch (e) {
    console.error("[GET /api/admin/coffee]", e);
    return NextResponse.json({ tabs: [], items: [], error: "Failed to load" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tabs, items } = await req.json();
    const sb = getSupabaseAdmin();

    const tabList: { id: string; label: string; order: number; active: boolean }[] = tabs ?? [];
    const itemList: {
      id: string; tabId: string; title: string; description?: string;
      price?: string; carouselImageUrl?: string; menuPageImageUrl?: string;
      alt?: string; tagLine?: string; ingredients?: string;
      tastingNotes?: string; notableNotes?: string;
      order: number; active: boolean; titleColor?: string;
      descriptionColor?: string; priceColor?: string;
    }[] = items ?? [];

    console.log("[POST /api/admin/coffee] tabs:", tabList.map((t) => t.id));
    console.log("[POST /api/admin/coffee] item tabIds:", itemList.map((i) => ({ id: i.id, tabId: i.tabId })));

    // Drop any items whose tabId has no matching tab (prevents FK violation)
    const tabIdSet = new Set(tabList.map((t) => t.id));
    const validItems = itemList.filter((i) => {
      const ok = i.tabId && tabIdSet.has(i.tabId);
      if (!ok) console.warn("[POST /api/admin/coffee] dropping orphan item:", i.id, "tabId:", i.tabId);
      return ok;
    });

    // Delete-then-insert: items first (they reference tabs), then tabs.
    const { error: delItemsErr } = await sb.from("coffee_items").delete().neq("id", "___never___");
    if (delItemsErr) {
      console.error("[POST /api/admin/coffee] delete items error:", delItemsErr);
      throw delItemsErr;
    }

    const { error: delTabsErr } = await sb.from("coffee_tabs").delete().neq("id", "___never___");
    if (delTabsErr) {
      console.error("[POST /api/admin/coffee] delete tabs error:", delTabsErr);
      throw delTabsErr;
    }

    if (tabList.length) {
      const { error } = await sb.from("coffee_tabs").insert(
        tabList.map((t) => ({ id: t.id, label: t.label, order: t.order, active: t.active }))
      );
      if (error) {
        console.error("[POST /api/admin/coffee] insert tabs error:", error);
        throw error;
      }
    }

    if (validItems.length) {
      const { error } = await sb.from("coffee_items").insert(
        validItems.map((i) => ({
          id: i.id, tab_id: i.tabId, title: i.title,
          description: i.description ?? null, price: i.price ?? null,
          carousel_image_url: i.carouselImageUrl ?? null,
          menu_page_image_url: i.menuPageImageUrl ?? null,
          alt: i.alt ?? null,
          tag_line: i.tagLine ?? null,
          ingredients: i.ingredients ?? null,
          tasting_notes: i.tastingNotes ?? null,
          notable_notes: i.notableNotes ?? null,
          order: i.order, active: i.active,
          title_color: i.titleColor ?? null,
          description_color: i.descriptionColor ?? null,
          price_color: i.priceColor ?? null,
          updated_at: new Date().toISOString(),
        }))
      );
      if (error) {
        console.error("[POST /api/admin/coffee] insert items error:", error);
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    console.error("[POST /api/admin/coffee] caught:", msg, e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, type } = await req.json();
    if (!id || !type) {
      return NextResponse.json({ success: false, error: "id and type required" }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    if (type === "tab") {
      await Promise.all([
        sb.from("coffee_items").delete().eq("tab_id", id),
        sb.from("coffee_tabs").delete().eq("id", id),
      ]);
    } else {
      const { error } = await sb.from("coffee_items").delete().eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    console.error("[DELETE /api/admin/coffee]", msg, e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
