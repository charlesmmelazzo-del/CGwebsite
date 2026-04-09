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

    const newTabIds: string[] = (tabs ?? []).map((t: { id: string }) => t.id);
    const newItemIds: string[] = (items ?? []).map((i: { id: string }) => i.id);

    // 1. Find and delete tabs that were removed
    const { data: existingTabs } = await sb.from("coffee_tabs").select("id");
    const tabsToDelete = (existingTabs ?? [])
      .map((r) => r.id)
      .filter((id) => !newTabIds.includes(id));
    if (tabsToDelete.length) {
      // Cascade: remove their items first (in case FK doesn't cascade)
      await sb.from("coffee_items").delete().in("tab_id", tabsToDelete);
      await sb.from("coffee_tabs").delete().in("id", tabsToDelete);
    }

    // 2. Find and delete items that were removed (within remaining tabs)
    const { data: existingItems } = await sb.from("coffee_items").select("id");
    const itemsToDelete = (existingItems ?? [])
      .map((r) => r.id)
      .filter((id) => !newItemIds.includes(id));
    if (itemsToDelete.length) {
      await sb.from("coffee_items").delete().in("id", itemsToDelete);
    }

    // 3. Upsert tabs
    if (newTabIds.length) {
      const { error: tabErr } = await sb.from("coffee_tabs").upsert(
        tabs.map((t: { id: string; label: string; order: number; active: boolean }) => ({
          id: t.id,
          label: t.label,
          order: t.order,
          active: t.active,
        })),
        { onConflict: "id" }
      );
      if (tabErr) throw tabErr;
    }

    // 4. Upsert items
    if (newItemIds.length) {
      const { error: itemErr } = await sb.from("coffee_items").upsert(
        items.map((i: {
          id: string; tabId: string; title: string; description?: string;
          price?: string; carouselImageUrl?: string; menuPageImageUrl?: string;
          alt?: string; tagLine?: string; ingredients?: string;
          tastingNotes?: string; notableNotes?: string;
          order: number; active: boolean; titleColor?: string;
          descriptionColor?: string; priceColor?: string;
        }) => ({
          id: i.id,
          tab_id: i.tabId,
          title: i.title,
          description: i.description ?? null,
          price: i.price ?? null,
          carousel_image_url: i.carouselImageUrl ?? null,
          menu_page_image_url: i.menuPageImageUrl ?? null,
          alt: i.alt ?? null,
          tag_line: i.tagLine ?? null,
          ingredients: i.ingredients ?? null,
          tasting_notes: i.tastingNotes ?? null,
          notable_notes: i.notableNotes ?? null,
          order: i.order,
          active: i.active,
          title_color: i.titleColor ?? null,
          description_color: i.descriptionColor ?? null,
          price_color: i.priceColor ?? null,
        })),
        { onConflict: "id" }
      );
      if (itemErr) throw itemErr;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    console.error("[POST /api/admin/coffee]", msg, e);
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
