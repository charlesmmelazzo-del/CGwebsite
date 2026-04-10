import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface CoffeeMenu {
  id: string;
  label: string;
  imageUrl: string | null;
  alt: string;
  order: number;
  active: boolean;
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
    if (menuList.length > 0) {
      const { error } = await sb.from("coffee_menus").upsert(
        menuList.map((m) => ({
          id: m.id,
          label: m.label,
          image_url: m.imageUrl,
          alt: m.alt ?? "",
          order_num: m.order,
          active: m.active,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "id" }
      );
      if (error) throw error;
      console.log("[coffee POST] upserted", menuList.length, "menus OK");
    }

    // Verify
    const { data: verify } = await sb.from("coffee_menus").select("id");
    console.log("[coffee POST] verified", verify?.length, "menus in DB");

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("[POST /api/admin/coffee]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
