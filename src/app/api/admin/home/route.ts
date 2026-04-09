import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { CarouselItem } from "@/types";

const DEFAULT_CAROUSEL: CarouselItem[] = [
  { id: "1", type: "text", order: 0, active: true, text: "Common Good is a cocktail house in the heart of Glen Ellyn, Illinois." },
  { id: "2", type: "text", order: 1, active: true, text: "Modern, classic, upscale, seasonal and sometimes whimsical cocktails." },
  { id: "3", type: "text", order: 2, active: true, text: "A space to celebrate life — from special occasions to day-to-day." },
];

const DEFAULT_DATA = { bgUrl: "", carouselItems: DEFAULT_CAROUSEL };

async function readData() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("home_settings").select("*").eq("id", 1).single();
  if (!data) return { ...DEFAULT_DATA, autoAdvance: true, autoAdvanceInterval: 6 };
  return {
    bgUrl: data.bg_url ?? "",
    carouselItems: (data.carousel_items as CarouselItem[]) ?? DEFAULT_CAROUSEL,
    autoAdvance: data.auto_advance ?? true,
    autoAdvanceInterval: data.auto_advance_interval ?? 6,
  };
}

export async function GET() {
  try {
    return NextResponse.json(await readData());
  } catch (e) {
    console.error("[GET /api/admin/home]", e);
    return NextResponse.json(DEFAULT_DATA);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("home_settings").upsert(
      {
        id: 1,
        bg_url: body.bgUrl ?? "",
        carousel_items: body.carouselItems ?? [],
        auto_advance: body.autoAdvance ?? true,
        auto_advance_interval: body.autoAdvanceInterval ?? 6,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/admin/home]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
