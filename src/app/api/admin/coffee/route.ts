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
      order: r.order,
      active: r.active,
      titleColor: r.title_color ?? undefined,
      descriptionColor: r.description_color ?? undefined,
      priceColor: r.price_color ?? undefined,
    }));
    return NextResponse.json({ tabs, items });
  } catch (e) {
    console.error("[GET /api/admin/coffee]", e);
    return NextResponse.json({ tabs: [], items: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tabs, items } = await req.json();
    const sb = getSupabaseAdmin();

    const newTabIds: string[] = (tabs ?? []).map((t: { id: string }) => t.id);
    const newItemIds: string[] = (items ?? []).map((i: { id: string }) => i.id);

    // Delete removed tabs (cascade their items first)
    const { data: existingTabs } = await sb.from("coffee_tabs").select("id");
    const tabsToDelete = (existingTabs ?? []).map((r) => r.id).filter((id) => !newTabIds.includes(id));
    if (tabsToDelete.length) {
      await sb.from("coffee_items").delete().in("tab_id", tabsToDelete);
      await sb.from("coffee_tabs").delete().in("id", tabsToDelete);
    }

    // Delete removed items
    const { data: existingItems } = await sb.from("coffee_items").select("id");
    const itemsToDelete = (existingItems ?? []).map((r) => r.id).filter((id) => !newItemIds.includes(id));
    if (itemsToDelete.length) {
      await sb.from("coffee_items").delete().in("id", itemsToDelete);
    }

    if (newTabIds.length) {
      const { error } = await sb.from("coffee_tabs").upsert(
        tabs.map((t: { id: string; label: string; order: number; active: boolean }) => ({
          id: t.id, label: t.label, order: t.order, active: t.active,
        })),
        { onConflict: "id" }
      );
      if (error) throw error;
    }
    if (newItemIds.length) {
      const { error } = await sb.from("coffee_items").upsert(
        items.map((i: {
          id: string; tabId: string; title: string; description?: string;
          price?: string; carouselImageUrl?: string; menuPageImageUrl?: string;
          order: number; active: boolean; titleColor?: string;
          descriptionColor?: string; priceColor?: string;
        }) => ({
          id: i.id, tab_id: i.tabId, title: i.title,
          description: i.description ?? null, price: i.price ?? null,
          carousel_image_url: i.carouselImageUrl ?? null,
          menu_page_image_url: i.menuPageImageUrl ?? null,
          order: i.order, active: i.active,
          title_color: i.titleColor ?? null,
          description_color: i.descriptionColor ?? null,
          price_color: i.priceColor ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "id" }
      );
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/admin/coffee]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
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
    console.error("[DELETE /api/admin/coffee]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
