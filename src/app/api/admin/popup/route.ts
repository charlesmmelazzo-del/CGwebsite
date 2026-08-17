import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAllMenus, getCocktails, getMenuById, mapMenu } from "@/lib/popup/menus";
import { getVoterCount } from "@/lib/popup/voting";
import type { PopupCocktail } from "@/lib/popup/types";

// Protected by the middleware matcher on /api/admin/:path*.

/** Turn a title into a URL-safe slug. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** GET — every pop-up, with cocktail and voter counts for the list view. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  // Single pop-up (the editor)
  if (id) {
    const menu = await getMenuById(id);
    if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cocktails = await getCocktails(menu.id, { includeInactive: true });
    return NextResponse.json({ menu, cocktails });
  }

  // All pop-ups (the list)
  const menus = await getAllMenus();
  const counts = await Promise.all(
    menus.map(async (m) => ({
      id: m.id,
      cocktails: (await getCocktails(m.id, { includeInactive: true })).length,
      voters: await getVoterCount(m.id),
    }))
  );
  const countById = new Map(counts.map((c) => [c.id, c]));

  return NextResponse.json({
    menus: menus.map((m) => ({
      ...m,
      cocktailCount: countById.get(m.id)?.cocktails ?? 0,
      voterCount: countById.get(m.id)?.voters ?? 0,
    })),
  });
}

/**
 * POST — create or update a pop-up and its cocktails in one save.
 *
 * Status is deliberately NOT settable here: going live, scheduling and
 * archiving all run through /api/admin/popup/status, so the rule "only one
 * pop-up is live" lives in exactly one place.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const menu = (body.menu ?? {}) as Record<string, unknown>;
  const cocktails = (body.cocktails ?? []) as Partial<PopupCocktail>[];

  const title = String(menu.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Give the pop-up a title." }, { status: 400 });

  const slug = slugify(String(menu.slug ?? "") || title);
  if (!slug) {
    return NextResponse.json(
      { error: "Could not build a web address from that title — add a slug." },
      { status: 400 }
    );
  }

  const weights = Array.isArray(menu.voteWeights)
    ? (menu.voteWeights as unknown[]).map((w) => Math.max(0, Math.round(Number(w) || 0)))
    : [3, 2, 1];
  const rankDepth = Math.min(10, Math.max(1, Math.round(Number(menu.voteRankDepth ?? 3)) || 3));

  const row = {
    slug,
    title,
    subtitle: (menu.subtitle as string) || null,
    description: (menu.description as string) || null,
    template_key: (menu.templateKey as string) || "classic",
    config: (menu.config as Record<string, unknown>) ?? {},
    vote_rank_depth: rankDepth,
    // Always as many weights as ranks, so no rank silently scores nothing.
    vote_weights: Array.from({ length: rankDepth }, (_, i) => weights[i] ?? 0),
    voting_enabled: menu.votingEnabled !== false,
    bg_color: (menu.bgColor as string) || null,
    text_color: (menu.textColor as string) || null,
    accent_color: (menu.accentColor as string) || null,
    cover_image_url: (menu.coverImageUrl as string) || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const sb = getSupabaseAdmin();
    const existingId = menu.id ? String(menu.id) : "";

    let menuId = existingId;
    if (existingId) {
      const { error } = await sb.from("popup_menus").update(row).eq("id", existingId);
      if (error) throw error;
    } else {
      const { data, error } = await sb
        .from("popup_menus")
        .insert({ ...row, status: "draft" })
        .select("*")
        .single();
      if (error) throw error;
      menuId = String(data.id);
    }

    // ── Cocktails: upsert what's here, delete what's gone ────────────────────
    const keepIds: string[] = [];
    for (let i = 0; i < cocktails.length; i++) {
      const c = cocktails[i];
      const name = String(c.name ?? "").trim();
      if (!name) continue;

      const cocktailRow = {
        menu_id: menuId,
        name,
        tagline: c.tagline || null,
        description: c.description || null,
        ingredients: c.ingredients || null,
        image_url: c.imageUrl || null,
        order: i,
        active: c.active !== false,
        meta: c.meta ?? {},
      };

      if (c.id && !String(c.id).startsWith("new-")) {
        const { error } = await sb.from("popup_cocktails").update(cocktailRow).eq("id", c.id);
        if (error) throw error;
        keepIds.push(String(c.id));
      } else {
        const { data, error } = await sb
          .from("popup_cocktails")
          .insert(cocktailRow)
          .select("id")
          .single();
        if (error) throw error;
        keepIds.push(String(data.id));
      }
    }

    const { data: existing } = await sb
      .from("popup_cocktails")
      .select("id")
      .eq("menu_id", menuId);
    const toDelete = (existing ?? [])
      .map((r) => String(r.id))
      .filter((id) => !keepIds.includes(id));
    if (toDelete.length) {
      // Votes cascade with the cocktail (FK on delete cascade).
      await sb.from("popup_cocktails").delete().in("id", toDelete);
    }

    const { data: saved } = await sb.from("popup_menus").select("*").eq("id", menuId).single();
    return NextResponse.json({ ok: true, menu: saved ? mapMenu(saved) : null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save the pop-up.";
    console.error("[POST /api/admin/popup]", e);
    // Surface the real cause — a duplicate slug is the common one and the
    // owner can't fix it from a generic "something went wrong".
    return NextResponse.json(
      {
        error: message.includes("duplicate key")
          ? "Another pop-up already uses that web address. Change the slug."
          : message,
      },
      { status: 400 }
    );
  }
}

/** DELETE — remove a pop-up entirely, along with its cocktails and votes. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("popup_menus").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/admin/popup]", e);
    return NextResponse.json({ error: "Could not delete the pop-up." }, { status: 500 });
  }
}
