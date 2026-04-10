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

    console.log("[coffee POST] received tabs:", tabList.length, "items:", itemList.length);
    console.log("[coffee POST] tab IDs:", tabList.map((t) => t.id));

    // 1. Get current state from DB
    const [existingTabsRes, existingItemsRes] = await Promise.all([
      sb.from("coffee_tabs").select("id"),
      sb.from("coffee_items").select("id"),
    ]);

    const existingTabIds = new Set((existingTabsRes.data ?? []).map((r) => r.id));
    const existingItemIds = new Set((existingItemsRes.data ?? []).map((r) => r.id));
    const newTabIds = new Set(tabList.map((t) => t.id));
    const newItemIds = new Set(itemList.map((i) => i.id));

    console.log("[coffee POST] existing tabs:", existingTabIds.size, "existing items:", existingItemIds.size);

    // 2. Delete removed items FIRST (they hold FK refs to tabs)
    const removedItemIds = [...existingItemIds].filter((id) => !newItemIds.has(id));
    if (removedItemIds.length > 0) {
      const { error } = await sb.from("coffee_items").delete().in("id", removedItemIds);
      if (error) {
        console.error("[coffee POST] delete removed items error:", error);
        throw error;
      }
      console.log("[coffee POST] deleted", removedItemIds.length, "removed items");
    }

    // 3. Delete removed tabs (safe now — their items are gone)
    const removedTabIds = [...existingTabIds].filter((id) => !newTabIds.has(id));
    if (removedTabIds.length > 0) {
      // Also sweep any orphaned items referencing these tabs
      await sb.from("coffee_items").delete().in("tab_id", removedTabIds);
      const { error } = await sb.from("coffee_tabs").delete().in("id", removedTabIds);
      if (error) {
        console.error("[coffee POST] delete removed tabs error:", error);
        throw error;
      }
      console.log("[coffee POST] deleted", removedTabIds.length, "removed tabs");
    }

    // 4. Upsert tabs
    if (tabList.length > 0) {
      const { error: tabErr } = await sb.from("coffee_tabs").upsert(
        tabList.map((t) => ({
          id: t.id,
          label: t.label,
          order: t.order,
          active: t.active,
        })),
        { onConflict: "id" }
      );
      if (tabErr) {
        console.error("[coffee POST] upsert tabs error:", tabErr);
        throw tabErr;
      }
      console.log("[coffee POST] upserted", tabList.length, "tabs OK");
    }

    // 5. Upsert items (only those whose tabId exists in payload)
    const validItems = itemList.filter((i) => i.tabId && newTabIds.has(i.tabId));
    if (validItems.length > 0) {
      const { error: itemErr } = await sb.from("coffee_items").upsert(
        validItems.map((i) => ({
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
      if (itemErr) {
        console.error("[coffee POST] upsert items error:", itemErr);
        throw itemErr;
      }
      console.log("[coffee POST] upserted", validItems.length, "items OK");
    }

    // Verification read
    const [verifyTabs, verifyItems] = await Promise.all([
      sb.from("coffee_tabs").select("id").limit(50),
      sb.from("coffee_items").select("id").limit(50),
    ]);
    console.log("[coffee POST] VERIFY — tabs in DB:", verifyTabs.data?.length, "items in DB:", verifyItems.data?.length);

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
      // Delete items FIRST (they hold FK to tabs), THEN delete the tab
      await sb.from("coffee_items").delete().eq("tab_id", id);
      await sb.from("coffee_tabs").delete().eq("id", id);
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
