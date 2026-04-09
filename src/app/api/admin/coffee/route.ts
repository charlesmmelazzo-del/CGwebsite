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

    // Validate: drop items whose tabId doesn't match any tab in the payload
    const tabIdSet = new Set(tabList.map((t) => t.id));
    const validItems = itemList.filter((i) => i.tabId && tabIdSet.has(i.tabId));

    // Step 1: Delete ALL existing items first (they hold FK references to tabs)
    const { error: delItemsErr } = await sb
      .from("coffee_items")
      .delete()
      .gte("order", -1);
    if (delItemsErr) {
      console.error("[coffee POST] delete items error:", delItemsErr);
      throw delItemsErr;
    }

    // Step 2: Delete ALL existing tabs (safe now — no items reference them)
    const { error: delTabsErr } = await sb
      .from("coffee_tabs")
      .delete()
      .gte("order", -1);
    if (delTabsErr) {
      console.error("[coffee POST] delete tabs error:", delTabsErr);
      throw delTabsErr;
    }

    // Step 3: Insert tabs fresh
    if (tabList.length) {
      const { data: insertedTabs, error: tabErr } = await sb
        .from("coffee_tabs")
        .insert(
          tabList.map((t) => ({
            id: t.id,
            label: t.label,
            order: t.order,
            active: t.active,
          }))
        )
        .select("id");

      if (tabErr) {
        console.error("[coffee POST] insert tabs error:", tabErr);
        throw tabErr;
      }

      // Step 3b: Verify every tab actually landed
      const insertedIds = new Set((insertedTabs ?? []).map((r) => r.id));
      const missingTabs = tabList.filter((t) => !insertedIds.has(t.id));
      if (missingTabs.length) {
        console.error("[coffee POST] tabs failed to insert:", missingTabs.map((t) => t.id));
        throw new Error(
          `Failed to insert ${missingTabs.length} tab(s). Check that the coffee_tabs 'id' column ` +
          `is type TEXT or UUID with no server-side default that overrides the provided value.`
        );
      }
    }

    // Step 4: Insert items (tabs are confirmed in DB — FK will resolve)
    if (validItems.length) {
      const { error: itemErr } = await sb.from("coffee_items").insert(
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
        }))
      );
      if (itemErr) {
        console.error("[coffee POST] insert items error:", itemErr);
        throw itemErr;
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
